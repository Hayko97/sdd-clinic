import {
  previousArtifactTemplates,
  artifactTemplates,
} from "../src/server/documentation.js";
import { afterEach, expect, it } from "vitest";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/vault.js";
import { defaultSkills } from "../src/server/skills.js";
import { fixtureEngine, fixtureRepo, tempDir, waitRun } from "./helpers.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});
async function fixture(existing = false) {
  const root = await tempDir();
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await mkdir(repo);
  if (existing) await fixtureRepo(repo);
  const c = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
  });
  cleanups.push(() => c.app.close());
  const project = await c.projects.add(repo, "codex", "Documentation project");
  const session = await c.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: c.bootstrapToken },
  });
  const headers = { cookie: `clinic_session=${session.cookies[0]!.value}` };
  async function setup() {
    const setup = await c.projects.setupFiles(project);
    if (setup.files.length)
      await c.specs.apply(
        project,
        (await c.specs.propose(project, "Setup", setup.files, "setup")).id,
      );
    return setup;
  }
  return {
    ...c,
    repo,
    project,
    headers,
    setup,
    prefix: `/api/projects/${project.id}`,
  };
}

it("installs a portable native schema and guidance, upgrades stock skills and preserves customized files", async () => {
  const c = await fixture();
  await mkdir(join(c.repo, ".clinic/skills/create-spec"), { recursive: true });
  await mkdir(join(c.repo, ".clinic/skills/refine-spec"), { recursive: true });
  await writeFile(
    join(c.repo, ".clinic/skills/create-spec/SKILL.md"),
    defaultSkills.find((s) => s.name === "create-spec")!.previousContent,
  );
  await writeFile(
    join(c.repo, ".clinic/skills/refine-spec/SKILL.md"),
    "Our customized refinement workflow.",
  );
  const prepared = await c.setup();
  expect(
    prepared.files.some(
      (f) => f.path === ".clinic/skills/create-spec/SKILL.md",
    ),
  ).toBe(true);
  expect(
    await readFile(join(c.repo, ".clinic/skills/refine-spec/SKILL.md"), "utf8"),
  ).toBe("Our customized refinement workflow.");
  expect(
    await readFile(join(c.repo, "openspec/config.yaml"), "utf8"),
  ).toContain("clinic-sdd");
  expect(
    (await c.specs.list(c.project)).filter((f) => f.kind === "project"),
  ).toHaveLength(4);
  const validation = await c.specs.openSpec(c.repo, [
    "schema",
    "validate",
    "clinic-sdd",
  ]);
  expect(validation.code, validation.stderr + validation.stdout).toBe(0);
  await writeFile(
    join(c.repo, "openspec/project/mission.md"),
    "Our owner's mission.",
  );
  await writeFile(
    join(c.repo, "openspec/config.yaml"),
    "schema: custom-workflow\n",
  );
  expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
  expect(
    await readFile(join(c.repo, "openspec/project/mission.md"), "utf8"),
  ).toBe("Our owner's mission.");
});

it("reviews a complete change folder before writing and rejects its unfinished scaffold", async () => {
  const c = await fixture();
  await c.setup();
  const response = await c.app.inject({
    method: "POST",
    url: `${c.prefix}/changes`,
    headers: c.headers,
    payload: {
      name: "search",
      title: "Search",
      description: "Find project records.",
    },
  });
  expect(response.statusCode).toBe(200);
  const proposal = response.json().proposal;
  expect(proposal.files).toHaveLength(7);
  expect(
    (await c.specs.list(c.project)).some((f) => f.change === "search"),
  ).toBe(false);
  await c.specs.apply(c.project, proposal.id);
  expect(
    (await c.specs.list(c.project))
      .filter((f) => f.change === "search")
      .map((f) => f.path.split("/").at(-1)),
  ).toEqual(
    expect.arrayContaining([
      "research.md",
      "proposal.md",
      "design.md",
      "validation.md",
      "tasks.md",
      "spec.md",
    ]),
  );
  const status = await c.specs.openSpec(c.repo, [
    "status",
    "--change",
    "search",
    "--json",
  ]);
  expect(status.code, status.stderr).toBe(0);
  expect(
    JSON.parse(status.stdout).artifacts.map((a: { id: string }) => a.id),
  ).toContain("validation");
  const instructions = await c.specs.openSpec(c.repo, [
    "instructions",
    "validation",
    "--change",
    "search",
    "--json",
  ]);
  expect(instructions.code, instructions.stderr).toBe(0);
  expect(JSON.parse(instructions.stdout).template).toContain(
    "Scenario coverage",
  );
  await expect(c.specs.approve(c.project, "search")).rejects.toThrow(
    "draft artifacts",
  );
  await expect(
    c.specs.createChange(c.project, "search", "Duplicate", "Do not overwrite"),
  ).rejects.toThrow("already exists");
});

it("requires planned coverage and invalidates approval when shared guidance changes", async () => {
  const c = await fixture(true);
  await c.setup();
  const folder = join(c.repo, "openspec/changes/fix-addition");
  // Existing standard changes keep their original contract.
  expect((await c.specs.approve(c.project, "fix-addition")).state).toBe(
    "ready",
  );
  await rm(join(folder, ".openspec.yaml"));
  expect((await c.specs.approve(c.project, "fix-addition")).state).toBe(
    "ready",
  );
  await writeFile(
    join(folder, ".openspec.yaml"),
    "schema: clinic-sdd\ncreated: 2026-10-18\n",
  );
  await expect(c.specs.approve(c.project, "fix-addition")).rejects.toThrow(
    "research.md",
  );
  await writeFile(
    join(folder, "research.md"),
    "# Research\nThe current math.ts implementation subtracts. Reuse calculator; no network research is necessary for integer addition.\n",
  );
  await writeFile(
    join(folder, "validation.md"),
    "# Validation\nNo coverage recorded yet.\n",
  );
  await expect(c.specs.approve(c.project, "fix-addition")).rejects.toThrow(
    "Adding numbers",
  );
  await writeFile(
    join(folder, "validation.md"),
    "# Validation plan\n| Scenario | Check | Expected evidence |\n| --- | --- | --- |\n| Adding numbers | node check.mts | add(2,3) equals 5 |\n",
  );
  expect((await c.specs.approve(c.project, "fix-addition")).state).toBe(
    "ready",
  );
  await writeFile(
    join(c.repo, "openspec/project/mission.md"),
    "Changed product constraint.",
  );
  expect((await c.specs.refreshApproval(c.project, "fix-addition")).state).toBe(
    "draft",
  );
});

it("implements and independently verifies a Clinic bundle with its exact project guidance and schema", async () => {
  const c = await fixture(true);
  await c.setup();
  const folder = join(c.repo, "openspec/changes/fix-addition");
  await writeFile(
    join(folder, ".openspec.yaml"),
    "schema: clinic-sdd\ncreated: 2026-10-18\n",
  );
  await writeFile(
    join(folder, "research.md"),
    "# Research\nmath.ts subtracts instead of adding. Arithmetic needs no external research; retain the calculator capability.\n",
  );
  const validation =
    "# Validation plan\n| Scenario | Check | Expected evidence |\n| --- | --- | --- |\n| Adding numbers | node check.mts | result equals 5 |\n";
  await writeFile(join(folder, "validation.md"), validation);
  await c.projects.saveConfig(c.project, {
    name: "Fixture",
    commands: [
      { name: "Addition", command: process.execPath, args: ["check.mts"] },
    ],
  });
  c.store.put("engine", {
    id: "codex",
    path: await fixtureEngine(c.repo),
    connected: true,
  });
  const approved = await c.specs.approve(c.project, "fix-addition");
  const run = await c.runs.develop(c.project, "fix-addition");
  const completed = await waitRun(c.store, run.id);
  expect(completed.status, completed.error).toBe("completed");
  const change = c.specs.change(c.project, "fix-addition");
  const qa = await waitRun(c.store, change.qaRunId!);
  expect(qa.qa?.verdict).toBe("passed");
  expect(qa.specHash).toBe(approved.approvedHash);
  for (const path of [
    "openspec/project/mission.md",
    "openspec/schemas/clinic-sdd/schema.yaml",
    "openspec/schemas/clinic-sdd/templates/validation.md",
  ])
    expect(await readFile(join(change.worktree!, path), "utf8")).toBe(
      await readFile(join(c.repo, path), "utf8"),
    );
  expect(
    await readFile(
      join(change.worktree!, "openspec/changes/fix-addition/validation.md"),
      "utf8",
    ),
  ).toBe(validation);
});

it("supports conflict-safe project edits and counts capabilities without their supporting documents", async () => {
  const c = await fixture();
  await c.setup();
  const path = "openspec/project/mission.md";
  const original = await c.specs.file(c.project, path);
  const edit = await c.app.inject({
    method: "POST",
    url: `${c.prefix}/edit`,
    headers: c.headers,
    payload: {
      path,
      baseHash: original.hash,
      content: "Our reviewed mission.",
    },
  });
  expect(edit.statusCode, edit.body).toBe(200);
  expect(await readFile(join(c.repo, path), "utf8")).toBe(original.content);
  await writeFile(join(c.repo, path), "External change.");
  await expect(c.specs.apply(c.project, edit.json().id)).rejects.toThrow(
    "changed outside",
  );
  await mkdir(join(c.repo, "openspec/specs/search"), { recursive: true });
  for (const file of ["spec.md", "design.md", "validation.md"])
    await writeFile(
      join(c.repo, "openspec/specs/search", file),
      "Search document.",
    );
  const state = (
    await c.app.inject({ url: "/api/state", headers: c.headers })
  ).json();
  expect(state.projects[0].specCount).toBe(1);
  expect(
    (await c.specs.list(c.project)).filter((f) => f.kind === "spec"),
  ).toHaveLength(3);
  const foreign = await c.projects.add(await tempDir(), "codex");
  cleanups.push(() => rm(foreign.path, { recursive: true, force: true }));
  await expect(c.specs.apply(foreign, edit.json().id)).rejects.toThrow(
    "not found",
  );
});

it("upgrades only exact old template defaults and exposes additional check prerequisites", async () => {
  const c = await fixture();
  const folder = join(c.repo, "openspec/schemas/clinic-sdd/templates");
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, "validation.md"),
    previousArtifactTemplates["validation.md"],
  );
  await writeFile(
    join(folder, "design.md"),
    previousArtifactTemplates["design.md"] + "\nCustom owner rules",
  );
  await writeFile(
    join(c.repo, "package.json"),
    JSON.stringify({
      scripts: {
        test: "vitest run",
        "test:db": "node tests/db.mjs",
        "test:e2e": "playwright test",
      },
    }),
  );
  const setup = await c.setup();
  expect(await readFile(join(folder, "validation.md"), "utf8")).toBe(
    artifactTemplates["validation.md"],
  );
  expect(await readFile(join(folder, "design.md"), "utf8")).toContain(
    "Custom owner rules",
  );
  expect(setup.inspection.questions.join("\n")).toContain("test:db");
  expect(setup.inspection.questions.join("\n")).toContain("test:e2e");
  expect(setup.inspection.questions.join("\n")).toContain("prerequisites");
  expect((await c.projects.setupFiles(c.project)).files).toHaveLength(0);
});
