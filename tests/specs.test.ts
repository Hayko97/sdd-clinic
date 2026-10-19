import { projectSkills } from "../src/server/skills.js";
import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { Store } from "../src/server/store.js";
import { Projects } from "../src/server/projects.js";
import { SpecRepository } from "../src/server/specs.js";
import { hash } from "../src/server/util.js";
import { tempDir, fixtureRepo } from "./helpers.js";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function setup() {
  const root = await tempDir();
  roots.push(root);
  const store = new Store(":memory:");
  const projects = new Projects(store),
    specs = new SpecRepository(store);
  const project = await projects.add(root, "codex");
  return { root, store, projects, specs, project };
}
describe("spec workspace acceptance", () => {
  it("reviews setup and preserves existing instructions across repeated setup", async () => {
    const { root, store, projects, specs, project } = await setup();
    await writeFile(join(root, "AGENTS.md"), "Keep this existing rule.\n");
    await mkdir(join(root, "prisma"));
    await writeFile(
      join(root, "prisma/schema.prisma"),
      "model Event { id Int @id }",
    );
    const prepared = await projects.setupFiles(project);
    expect(prepared.inspection.schemaFiles.map((f) => f.path)).toContain(
      "prisma/schema.prisma",
    );
    expect(prepared.inspection.questions).toHaveLength(1);
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(
      "Keep this existing rule.\n",
    );
    const proposal = await specs.propose(
      project,
      "Setup",
      prepared.files,
      "setup",
    );
    await specs.apply(project, proposal.id);
    const instructions = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(instructions).toContain("Keep this existing rule.");
    expect(instructions.match(/sdd-clinic:instructions -->/g)).toHaveLength(2);
    expect((await projects.setupFiles(project)).files).toHaveLength(0);
    expect(await projects.agents(project)).toHaveLength(3);
    expect((await projectSkills(project)).map((s) => s.name)).toEqual([
      "analyze-request",
      "create-spec",
      "implement-spec",
      "refine-spec",
    ]);
    const skillPath = join(root, ".clinic/skills/create-spec/SKILL.md");
    await writeFile(
      skillPath,
      "---\nname: create-spec\ndescription: Custom workflow\n---\nKeep my rules.",
    );
    expect((await projects.setupFiles(project)).files).toHaveLength(0);
    expect(
      (await projectSkills(project)).find((s) => s.name === "create-spec")
        ?.description,
    ).toBe("Custom workflow");
    const refinePath = join(root, ".clinic/skills/refine-spec/SKILL.md");
    await writeFile(
      refinePath,
      "---\nname: refine-spec\ndescription: Custom refinement\n---\nPreserve our terminology.",
    );
    expect((await projects.setupFiles(project)).files).toHaveLength(0);
    expect(
      (await projectSkills(project)).find((s) => s.name === "refine-spec")
        ?.description,
    ).toBe("Custom refinement");
    const otherRoot = await tempDir();
    roots.push(otherRoot);
    expect(await projectSkills(await projects.add(otherRoot, "codex"))).toEqual(
      [],
    );
    store.close();
  });
  it("rejects the whole edit when one base becomes stale", async () => {
    const { root, store, specs, project } = await setup();
    const proposal = await specs.propose(
      project,
      "Change",
      [
        { path: "openspec/changes/new/proposal.md", after: "One" },
        { path: "openspec/changes/new/design.md", after: "Two" },
      ],
      "manual",
      "new",
    );
    await mkdir(join(root, "openspec/changes/new"), { recursive: true });
    await writeFile(
      join(root, "openspec/changes/new/design.md"),
      "External edit",
    );
    await expect(specs.apply(project, proposal.id)).rejects.toThrow(
      "changed outside",
    );
    await expect(
      readFile(join(root, "openspec/changes/new/proposal.md")),
    ).rejects.toThrow();
    expect(
      await readFile(join(root, "openspec/changes/new/design.md"), "utf8"),
    ).toBe("External edit");
    store.close();
  });
  it("rejects path traversal, duplicate paths, symlinks and cross-project proposals", async () => {
    const { root, store, projects, specs, project } = await setup();
    await expect(
      specs.propose(
        project,
        "Escape",
        [{ path: "openspec/changes/new/../../../escape.md", after: "no" }],
        "manual",
        "new",
      ),
    ).rejects.toThrow();
    await mkdir(join(root, "outside"));
    await mkdir(join(root, "openspec/changes"), { recursive: true });
    await symlink(join(root, "outside"), join(root, "openspec/changes/new"));
    await expect(
      specs.propose(
        project,
        "Symlink",
        [{ path: "openspec/changes/new/spec.md", after: "no" }],
        "manual",
        "new",
      ),
    ).rejects.toThrow("Symbolic");
    const otherRoot = await tempDir();
    roots.push(otherRoot);
    const other = await projects.add(otherRoot, "codex");
    const p = await specs.createChange(
      other,
      "new-change",
      "Title",
      "Description",
    );
    await expect(specs.apply(project, p.id)).rejects.toThrow("not found");
    store.close();
  });
  it("invalidates approved requirements but permits task completion metadata", async () => {
    const root = await tempDir();
    roots.push(root);
    await fixtureRepo(root);
    const store = new Store(":memory:"),
      projects = new Projects(store),
      specs = new SpecRepository(store);
    const project = await projects.add(root, "codex");
    const approved = await specs.approve(project, "fix-addition");
    expect(approved.state).toBe("ready");
    const tasks = join(root, "openspec/changes/fix-addition/tasks.md");
    await writeFile(
      tasks,
      (await readFile(tasks, "utf8")).replace("[ ]", "[x]"),
    );
    expect((await specs.refreshApproval(project, "fix-addition")).state).toBe(
      "ready",
    );
    await writeFile(
      join(root, "openspec/changes/fix-addition/design.md"),
      "Changed implementation intent.",
    );
    expect((await specs.refreshApproval(project, "fix-addition")).state).toBe(
      "draft",
    );
    store.close();
  });
  it("rejects new capability purposes that would become incomplete accepted specs", async () => {
    const root = await tempDir();
    roots.push(root);
    await fixtureRepo(root);
    const store = new Store(":memory:"),
      projects = new Projects(store),
      specs = new SpecRepository(store);
    const project = await projects.add(root, "codex");
    const path = join(
      root,
      "openspec/changes/fix-addition/specs/calculator/spec.md",
    );
    const original = await readFile(path, "utf8");
    await writeFile(
      path,
      original.replace(/## Purpose[\s\S]*?## ADDED/, "## ADDED"),
    );
    await expect(specs.approve(project, "fix-addition")).rejects.toThrow(
      "Purpose",
    );
    await writeFile(
      path,
      original.replace(
        "Provide predictable arithmetic results for consumers of the calculator.",
        "TBD: define this capability later.",
      ),
    );
    await expect(specs.approve(project, "fix-addition")).rejects.toThrow(
      "Purpose",
    );
    store.close();
  });
  it("checks context revisions before applying a new delta spec", async () => {
    const { root, store, specs, project } = await setup();
    await mkdir(join(root, "openspec/specs/auth"), { recursive: true });
    const path = "openspec/specs/auth/spec.md";
    await writeFile(join(root, path), "Original contract");
    const proposal = await specs.propose(
      project,
      "Update",
      [{ path: "openspec/changes/update/proposal.md", after: "Change" }],
      "manual",
      "update",
      [{ path, hash: hash("Original contract") }],
    );
    await writeFile(join(root, path), "New contract");
    await expect(specs.apply(project, proposal.id)).rejects.toThrow(
      "Context changed",
    );
    store.close();
  });
});
