import { afterEach, expect, it } from "vitest";
import { join } from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";
import { Workflows } from "../src/server/workflows.js";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/data.js";
import { adapters } from "../src/server/engines.js";
import type { EngineAdapter, DeveloperWorkflow } from "../src/shared/types.js";
import { fixtureRepo, fixtureEngine, tempDir } from "./helpers.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture(action = "refine") {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  const executable = await fixtureEngine(root);
  const prompts: string[] = [];
  const provider: EngineAdapter = {
    probe: adapters.codex.probe,
    async run(path, request) {
      prompts.push(request.prompt);
      if (request.prompt.includes("Analyze the user's intent"))
        return {
          sessionId: "analysis",
          text: JSON.stringify({
            summary: "Review addition behavior",
            action,
            change: ["clarify", "create"].includes(action)
              ? undefined
              : "fix-addition",
            questions: action === "clarify" ? ["Which operands?"] : [],
          }),
        };
      if (
        action === "create" &&
        request.prompt.includes(
          "Propose an OpenSpec change, without writing files",
        )
      ) {
        const change = request.prompt.match(
          /inside openspec\/changes\/([^/]+)\//,
        )![1]!;
        const files = await Promise.all(
          [
            ".openspec.yaml",
            "proposal.md",
            "design.md",
            "tasks.md",
            "specs/calculator/spec.md",
          ].map(async (name) => ({
            path: `openspec/changes/${change}/${name}`,
            content: await readFile(
              join(repo, "openspec/changes/fix-addition", name),
              "utf8",
            ),
          })),
        );
        return {
          sessionId: "author",
          text: JSON.stringify({ summary: "New calculator behavior", files }),
        };
      }
      if (
        request.prompt.includes(
          "Propose an OpenSpec change, without writing files",
        )
      )
        return {
          sessionId: "author",
          text: JSON.stringify({
            summary: "Clarify addition intent",
            files: [
              {
                path: "openspec/changes/fix-addition/proposal.md",
                content:
                  (await readFile(
                    join(repo, "openspec/changes/fix-addition/proposal.md"),
                    "utf8",
                  )) + "\nClarified requested behavior.\n",
              },
            ],
          }),
        };
      return adapters.codex.run(path, request);
    },
  };
  const clinic = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
    providers: { codex: provider, claude: provider },
  });
  cleanup.push(() => clinic.app.close());
  clinic.store.put("engine", {
    id: "codex",
    path: executable,
    connected: true,
  });
  const project = await clinic.projects.add(repo, "codex");
  const setup = await clinic.projects.setupFiles(project);
  await clinic.specs.apply(
    project,
    (await clinic.specs.propose(project, "setup", setup.files, "setup")).id,
  );
  await clinic.projects.saveConfig(project, {
    name: "fixture",
    engine: "codex",
    commands: [
      {
        name: "Addition test",
        command: process.execPath,
        args: ["check.mts"],
        phase: "check",
      },
    ],
  });
  const session = await clinic.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: clinic.bootstrapToken },
  });
  const headers = { cookie: `clinic_session=${session.cookies[0]!.value}` };
  return { ...clinic, project, root, repo, prompts, headers };
}
async function waitFor(
  get: () => DeveloperWorkflow,
  predicate: (f: DeveloperWorkflow) => boolean,
) {
  for (let i = 0; i < 600; i++) {
    const flow = get();
    if (predicate(flow)) return flow;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(JSON.stringify(get()));
}
it("analyzes, refines, waits for review, then implements and runs QA with project skills", async () => {
  const c = await fixture();
  const flow = await c.workflows.start(c.project, "Fix addition");
  const pending = await waitFor(
    () => c.workflows.list(c.project).find((f) => f.id === flow.id)!,
    (f) => f.stage === "awaiting-review",
  );
  expect(await readFile(join(c.repo, "math.ts"), "utf8")).toContain("a - b");
  expect(c.prompts[0]).toContain("# analyze-request");
  expect(c.prompts[0]).toContain("openspec/project/mission.md");
  expect(c.prompts[1]).toContain("# refine-spec");
  expect(c.prompts[1]).toContain("validation.md");
  expect(c.store.replay(pending.runId!).some((e) => e.type === "skill")).toBe(
    true,
  );
  const other = await c.projects.add(await tempDir(), "codex");
  cleanup.push(() => rm(other.path, { recursive: true, force: true }));
  expect(
    (
      await c.app.inject({
        method: "POST",
        url: `/api/projects/${other.id}/workflows/${flow.id}/continue`,
        headers: c.headers,
        payload: {},
      })
    ).statusCode,
  ).toBe(404);
  await c.workflows.continue(c.project, flow.id);
  await expect(c.workflows.continue(c.project, flow.id)).rejects.toThrow(
    "not waiting",
  );
  const done = await waitFor(
    () => c.workflows.list(c.project).find((f) => f.id === flow.id)!,
    (f) => ["review", "failed"].includes(f.stage),
  );
  expect(done.error).toBeUndefined();
  expect(done.stage).toBe("review");
  expect(c.prompts.some((p) => p.includes("# implement-spec"))).toBe(true);
});
it("uses an approved unchanged change without another authoring request", async () => {
  const c = await fixture("implement");
  await c.specs.approve(c.project, "fix-addition");
  const flow = await c.workflows.start(
    c.project,
    "Implement the approved addition behavior",
  );
  const done = await waitFor(
    () => c.workflows.list(c.project).find((f) => f.id === flow.id)!,
    (f) => ["review", "failed"].includes(f.stage),
  );
  expect(done.stage).toBe("review");
  expect(done.proposalId).toBeUndefined();
});
it("preserves clarification, blocks missing skills, and rejects stale proposal application", async () => {
  const c = await fixture("clarify");
  const flow = await c.workflows.start(c.project, "Change it");
  await waitFor(
    () => c.workflows.get(c.project, flow.id),
    (f) => f.stage === "needs-input",
  );
  await expect(c.workflows.continue(c.project, flow.id)).rejects.toThrow(
    "Answer",
  );
  c.workflows.cancel(c.project, flow.id);
  expect(c.workflows.get(c.project, flow.id).prompt).toBe("Change it");
  await rm(join(c.repo, ".clinic/skills/analyze-request/SKILL.md"));
  await expect(c.workflows.start(c.project, "Something else")).rejects.toThrow(
    "analyze-request",
  );
  const c2 = await fixture();
  const another = await c2.workflows.start(c2.project, "Clarify addition");
  await waitFor(
    () => c2.workflows.get(c2.project, another.id),
    (f) => f.stage === "awaiting-review",
  );
  await writeFile(
    join(c2.repo, "openspec/changes/fix-addition/proposal.md"),
    "External edit",
  );
  await expect(c2.workflows.continue(c2.project, another.id)).rejects.toThrow(
    "changed outside",
  );
  expect(c2.workflows.get(c2.project, another.id).stage).toBe(
    "awaiting-review",
  );
});
it("validates repository schedules, skips offline or overlapping work and records provider failures", async () => {
  const c = await fixture();
  await expect(
    c.agentSchedules.save(c.project, "daily", {
      agentId: "missing",
      prompt: "x",
      intervalHours: 1,
    }),
  ).rejects.toThrow("Agent not found");
  await expect(
    c.agentSchedules.save(c.project, "qa", { agentId: "qa", intervalHours: 1 }),
  ).rejects.toThrow("Choose a change");
  let schedule = await c.agentSchedules.save(c.project, "daily", {
    agentId: "developer",
    prompt: "Review addition",
    intervalHours: 1,
    enabled: true,
  });
  await c.agentSchedules.tick(
    true,
    new Date(Date.parse(schedule.nextRunAt!) + 3600000),
  );
  schedule = (await c.agentSchedules.list(c.project))[0]!;
  expect(schedule.lastOutcome).toContain("offline");
  expect(schedule.skipped).toBe(2);
  const flow = await c.workflows.start(c.project, "Review addition");
  await waitFor(
    () => c.workflows.get(c.project, flow.id),
    (f) => f.stage === "awaiting-review",
  );
  await c.agentSchedules.tick(false, new Date(schedule.nextRunAt!));
  schedule = (await c.agentSchedules.list(c.project))[0]!;
  expect(schedule.lastOutcome).toContain("active work");
  c.workflows.cancel(c.project, flow.id);
  c.store.put("engine", { id: "codex", path: "missing", connected: false });
  await c.agentSchedules.tick(false, new Date(schedule.nextRunAt!));
  schedule = (await c.agentSchedules.list(c.project))[0]!;
  expect(schedule.lastOutcome).toContain("Failed: Connect codex");
  expect(c.store.list("schedule-occurrence", c.project.id)).toHaveLength(3);
});

it("serializes concurrent starts and preserves interrupted workflow evidence without replay", async () => {
  const c = await fixture("clarify");
  const starts = await Promise.allSettled([
    c.workflows.start(c.project, "Change addition"),
    c.workflows.start(c.project, "Duplicate request"),
  ]);
  expect(starts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const flow = (
    starts.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<DeveloperWorkflow>
  ).value;
  await waitFor(
    () => c.workflows.get(c.project, flow.id),
    (f) => f.stage === "needs-input",
  );
  c.workflows.update(c.workflows.get(c.project, flow.id), {
    stage: "continuing",
  });
  const calls = c.prompts.length;
  const recovered = new Workflows(c.runs);
  expect(recovered.get(c.project, flow.id).stage).toBe("interrupted");
  expect(recovered.get(c.project, flow.id).prompt).toBe("Change addition");
  expect(c.prompts.length).toBe(calls);
});

it("rejects changed existing specifications before continuing approval", async () => {
  const c = await fixture("implement");
  const flow = await c.workflows.start(
    c.project,
    "Implement the addition change",
  );
  const pending = await waitFor(
    () => c.workflows.get(c.project, flow.id),
    (f) => f.stage === "awaiting-review",
  );
  expect(pending.reviewHash).toBeTruthy();
  const file = join(c.repo, "openspec/changes/fix-addition/design.md");
  await writeFile(
    file,
    (await readFile(file, "utf8")) + "\nA changed decision.\n",
  );
  await expect(c.workflows.continue(c.project, flow.id)).rejects.toThrow(
    "edited after",
  );
  expect(
    c.store.list<any>("run", c.project.id).some((r) => r.kind === "developer"),
  ).toBe(false);
});

it("creates a complete proposal with the agent CLI override and records scheduled progress", async () => {
  const c = await fixture("create");
  c.store.put("engine", {
    ...c.store.require<any>("engine", "codex"),
    id: "claude",
  });
  const developer = (await c.projects.agents(c.project)).find(
    (a) => a.id === "developer",
  )!;
  await c.projects.saveAgent(c.project, { ...developer, engine: "claude" });
  const schedule = await c.agentSchedules.save(c.project, "new-feature", {
    agentId: "developer",
    prompt: "Add calculator behavior",
    intervalHours: 24,
    enabled: true,
  });
  await c.agentSchedules.tick(false, new Date(schedule.nextRunAt!));
  const flow = await waitFor(
    () => c.workflows.list(c.project)[0]!,
    (f) => ["awaiting-review", "failed"].includes(f.stage),
  );
  expect(flow.stage).toBe("awaiting-review");
  const proposal = c.store.require<any>("proposal", flow.proposalId!);
  expect(proposal.files).toHaveLength(7);
  expect(c.runs.get(flow.runId!).engine).toBe("claude");
  expect(c.prompts[1]).toContain("# create-spec");
  expect((await c.agentSchedules.list(c.project))[0]!.lastOutcome).toBe(
    "Developer: awaiting review",
  );
  expect(
    (await c.specs.list(c.project)).some((f) => f.change === flow.change),
  ).toBe(false);
  expect(
    c.store.list<any>("schedule-occurrence", c.project.id)[0].outcome,
  ).toBe("Developer: awaiting review");
});

it("supplies earlier conversation context only for the same project and agent", async () => {
  const c = await fixture("clarify");
  const first = await c.workflows.start(
    c.project,
    "The original calculator request",
  );
  await waitFor(
    () => c.workflows.get(c.project, first.id),
    (f) => f.stage === "needs-input",
  );
  c.workflows.cancel(c.project, first.id);
  const next = await c.workflows.start(
    c.project,
    "Use two positive integers",
    "developer",
    first.id,
  );
  await waitFor(
    () => c.workflows.get(c.project, next.id),
    (f) => f.stage === "needs-input",
  );
  expect(c.prompts.at(-1)).toContain("The original calculator request");
  expect(c.workflows.get(c.project, next.id).previousWorkflowId).toBe(first.id);
  c.workflows.cancel(c.project, next.id);
  const agent = (await c.projects.agents(c.project)).find(
    (a) => a.id === "developer",
  )!;
  await c.projects.saveAgent(c.project, { ...agent, id: "other-developer" });
  await expect(
    c.workflows.start(c.project, "New request", "other-developer", first.id),
  ).rejects.toThrow("different agent");
  const foreign = await c.projects.add(await tempDir(), "codex");
  cleanup.push(() => rm(foreign.path, { recursive: true, force: true }));
  await expect(
    c.workflows.start(foreign, "New request", "developer", first.id),
  ).rejects.toThrow("not found");
});
