import { afterEach, expect, it } from "vitest";
import { join } from "node:path";
import { readFile, writeFile, rm, access } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/vault.js";
import { adapters } from "../src/server/engines.js";
import { Workflows } from "../src/server/workflows.js";
import type {
  EngineAdapter,
  DeveloperWorkflow,
  Clarification,
} from "../src/shared/types.js";
import { fixtureRepo, fixtureEngine, tempDir } from "./helpers.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
});
async function fixture(stage: string, changeAnswer = false) {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  const executable = await fixtureEngine(root);
  let asked = false,
    changed = false;
  const prompts: string[] = [];
  const provider: EngineAdapter = {
    probe: adapters.codex.probe,
    async run(path, r) {
      prompts.push(r.prompt);
      if (r.prompt.includes("Analyze the user's intent")) {
        let action = "implement";
        if (stage === "analysis" && !asked) {
          asked = true;
          action = "clarify";
        } else if (
          (stage === "specification" && !asked) ||
          (changeAnswer && asked && !changed)
        )
          action = "refine";
        return {
          sessionId: "decision",
          text: JSON.stringify({
            action,
            change: "fix-addition",
            summary: "Addition intent",
            questions:
              action === "clarify"
                ? ["Should negative operands be supported?"]
                : [],
          }),
        };
      }
      if (r.prompt.includes("Propose an OpenSpec change")) {
        if (stage === "specification" && !asked) {
          asked = true;
          return {
            sessionId: "author",
            text: JSON.stringify({
              summary: "Missing intent",
              questions: ["Should negative operands be supported?"],
              files: [],
            }),
          };
        }
        changed = true;
        const existing = await readFile(
          join(repo, "openspec/changes/fix-addition/design.md"),
          "utf8",
        );
        return {
          sessionId: "author",
          text: JSON.stringify({
            summary: "Clarified negative operands",
            questions: [],
            files: [
              {
                path: "openspec/changes/fix-addition/design.md",
                content:
                  existing +
                  "\nNegative operands are included; use ordinary addition.\n",
              },
            ],
          }),
        };
      }
      if (
        r.prompt.includes("Implement the approved") &&
        stage === "implementation" &&
        !asked
      ) {
        asked = true;
        await writeFile(
          join(r.cwd, "partial.txt"),
          "preserved partial implementation",
        );
        return {
          sessionId: "developer",
          text: JSON.stringify({
            summary: "Partial work preserved",
            questions: ["Should negative operands be supported?"],
          }),
        };
      }
      if (
        r.prompt.includes("Independently verify") &&
        stage === "qa" &&
        !asked
      ) {
        asked = true;
        return {
          sessionId: "qa",
          text: JSON.stringify({
            summary: "Unclear domain",
            questions: ["Should negative operands be supported?"],
          }),
        };
      }
      return adapters.codex.run(path, r);
    },
  };
  const c = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
    providers: { codex: provider, claude: provider },
  });
  cleanup.push(() => c.app.close());
  c.store.put("engine", { id: "codex", path: executable, connected: true });
  const project = await c.projects.add(repo, "codex");
  const setup = await c.projects.setupFiles(project);
  await c.specs.apply(
    project,
    (await c.specs.propose(project, "setup", setup.files, "setup")).id,
  );
  await c.projects.saveConfig(project, {
    name: "fixture",
    engine: "codex",
    commands: [
      {
        name: "Addition",
        command: process.execPath,
        args: ["check.mts"],
        phase: "check",
      },
    ],
  });
  await c.specs.approve(project, "fix-addition");
  return { ...c, root, repo, project, prompts };
}
async function waitFlow(
  c: Awaited<ReturnType<typeof fixture>>,
  id: string,
  stage: DeveloperWorkflow["stage"],
) {
  for (let i = 0; i < 500; i++) {
    const f = c.workflows.list(c.project).find((f) => f.id === id)!;
    if (f.stage === stage) return f;
    if (f.stage === "failed") throw new Error(f.error);
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(
    `Timed out waiting for ${stage}: ${JSON.stringify(c.workflows.list(c.project))}`,
  );
}
for (const stage of ["analysis", "specification", "implementation", "qa"])
  it(`pauses and resumes ${stage} with the same workflow identity and durable decisions`, async () => {
    const c = await fixture(stage);
    const flow = await c.workflows.start(c.project, "Correct addition");
    const waiting = await waitFlow(c, flow.id, "needs-input");
    const q = c.store.require<Clarification>(
      "clarification",
      waiting.clarificationId!,
    );
    expect(q.questions[0]).toContain("negative");
    await expect(c.specs.approve(c.project, "fix-addition")).rejects.toThrow(
      "questions",
    );
    await expect(c.runs.finalize(c.project, "fix-addition")).rejects.toThrow();
    await expect(
      c.workflows.continue(c.project, flow.id, "Yes", "obsolete"),
    ).rejects.toThrow("obsolete");
    const worktree = c.specs.change(c.project, "fix-addition").worktree;
    const recovered = new Workflows(c.runs);
    expect(recovered.list(c.project).find((f) => f.id === flow.id)?.stage).toBe(
      "needs-input",
    );
    const resumed = await c.workflows.continue(
      c.project,
      flow.id,
      "Yes, negative operands use ordinary addition.",
      q.id,
    );
    expect(resumed.id).toBe(flow.id);
    const done = await waitFlow(c, flow.id, "review");
    expect(
      done.clarifications?.some((q) => q.answer?.includes("ordinary addition")),
    ).toBe(true);
    expect(
      c.prompts.some(
        (p) =>
          p.includes("Earlier product answers") &&
          p.includes("negative operands"),
      ),
    ).toBe(true);
    if (stage === "implementation") {
      expect(c.specs.change(c.project, "fix-addition").worktree).toBe(worktree);
      expect(await readFile(join(worktree!, "partial.txt"), "utf8")).toContain(
        "preserved",
      );
    }
  });
it("revises changed intent, invalidates approval and preserves partial implementation until reapproval", async () => {
  const c = await fixture("implementation", true);
  const flow = await c.workflows.start(c.project, "Correct addition");
  const waiting = await waitFlow(c, flow.id, "needs-input");
  const old = c.specs.change(c.project, "fix-addition");
  await c.workflows.continue(
    c.project,
    flow.id,
    "Include negative operands",
    waiting.clarificationId,
  );
  const review = await waitFlow(c, flow.id, "awaiting-review");
  expect(review.proposalId).toBeTruthy();
  expect(await readFile(join(old.worktree!, "partial.txt"), "utf8")).toContain(
    "preserved",
  );
  await c.workflows.continue(c.project, flow.id);
  await waitFlow(c, flow.id, "review");
  const next = c.specs.change(c.project, "fix-addition");
  expect(next.approvedHash).not.toBe(old.approvedHash);
  expect(next.worktree).toBe(old.worktree);
  expect(next.qaRunId).toBeTruthy();
});
it("rejects stale revision answers and cancels waiting runs without deleting partial work", async () => {
  const c = await fixture("implementation");
  const flow = await c.workflows.start(c.project, "Correct addition");
  const waiting = await waitFlow(c, flow.id, "needs-input");
  await writeFile(
    join(c.repo, "openspec/changes/fix-addition/design.md"),
    "Changed by owner",
  );
  await expect(
    c.workflows.continue(c.project, flow.id, "Yes", waiting.clarificationId),
  ).rejects.toThrow("Specification changed");
  const workspace = c.specs.change(c.project, "fix-addition").worktree!;
  c.workflows.cancel(c.project, flow.id);
  expect(
    c.store.require<Clarification>("clarification", waiting.clarificationId!)
      .status,
  ).toBe("canceled");
  await access(join(workspace, "partial.txt"));
});
it("can stop a durable waiting run and retains its partial work", async () => {
  const c = await fixture("implementation");
  const flow = await c.workflows.start(c.project, "Correct addition");
  const waiting = await waitFlow(c, flow.id, "needs-input");
  const q = c.store.require<Clarification>(
    "clarification",
    waiting.clarificationId!,
  );
  for (let i = 0; i < 100 && c.runs.active.has(q.ownerId); i++)
    await new Promise((r) => setTimeout(r, 10));
  c.runs.cancel(q.ownerId);
  expect(c.runs.get(q.ownerId).status).toBe("interrupted");
  expect(c.workflows.list(c.project).find((f) => f.id === flow.id)?.stage).toBe(
    "canceled",
  );
  await access(
    join(c.specs.change(c.project, "fix-addition").worktree!, "partial.txt"),
  );
});
