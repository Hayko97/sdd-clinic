import { afterEach, describe, expect, it } from "vitest";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { Projects } from "../src/server/projects.js";
import { SpecRepository } from "../src/server/specs.js";
import { Store } from "../src/server/store.js";
import { tempDir } from "./helpers.js";

const paths = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".cursor/rules/sdd-clinic.mdc",
];
const start = "<!-- sdd-clinic:instructions -->";
const end = "<!-- /sdd-clinic:instructions -->";
const oldBlock = `${start}\nUse OpenSpec for behavioral changes: read relevant specs, draft a change, review its proposal/design/tasks, implement, verify scenarios, then archive. Project context and agent definitions live in .clinic/. Preserve uncommitted work.\n${end}`;
const cleanups: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(engine: "codex" | "claude" = "codex") {
  const root = await tempDir();
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const store = new Store(":memory:");
  cleanups.push(() => store.close());
  const projects = new Projects(store);
  const specs = new SpecRepository(store);
  const project = await projects.add(root, engine);
  async function prepare() {
    const setup = await projects.setupFiles(project);
    return specs.propose(project, "Setup", setup.files, "setup");
  }
  async function write(path: string, contents: string) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return { root, projects, specs, project, prepare, write };
}

describe("portable agent instruction setup", () => {
  it.each(["codex", "claude"] as const)(
    "reviews and installs every native instruction file for %s with the complete workflow",
    async (engine) => {
      const c = await fixture(engine);
      const proposal = await c.prepare();
      for (const path of paths) {
        expect(proposal.files.map((f) => f.path)).toContain(path);
        await expect(readFile(join(c.root, path))).rejects.toThrow();
      }
      await c.specs.apply(c.project, proposal.id);
      for (const path of paths) {
        const content = await readFile(join(c.root, path), "utf8");
        expect(content).toContain("Before every development prompt");
        const skills = [
          ...content.matchAll(/\.clinic\/skills\/([a-z-]+)\/SKILL\.md/g),
        ].map((m) => m[1]);
        expect(skills).toEqual([
          "analyze-request",
          "refine-spec",
          "create-spec",
          "implement-spec",
        ]);
        for (const skill of skills)
          expect(
            await readFile(
              join(c.root, `.clinic/skills/${skill}/SKILL.md`),
              "utf8",
            ),
          ).toContain(`name: ${skill}`);
        for (const required of [
          "openspec/specs/",
          "openspec/changes/",
          "openspec/project/",
          "do not create duplicate specs or force edits",
          "For new features or missing intent",
          "required approval of the current revision before implementation",
          "test the acceptance scenarios",
          "mark only verified tasks complete",
          "no native skill loader",
          "repair them through Clinic's reviewed Set up SDD flow",
          "planning and read-only QA do not authorize implementation",
        ])
          expect(content).toContain(required);
      }
      const cursor = await readFile(join(c.root, paths[4]!), "utf8");
      expect(parse(cursor.split("---")[1]!)).toMatchObject({
        alwaysApply: true,
      });
      expect(
        (await c.projects.inspect(c.project)).docs.map((d) => d.path),
      ).toEqual(expect.arrayContaining(paths));
      expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
    },
  );

  it.each(["\n", "\r\n"])(
    "upgrades only the old default block with %j line endings",
    async (newline) => {
      const c = await fixture();
      const prefix = `# Team rules${newline}Use our test runner.${newline}${newline}`;
      const suffix = `${newline}${newline}Keep the owner's instructions. $& $'${newline}`;
      for (const path of ["AGENTS.md", "CLAUDE.md"])
        await c.write(
          path,
          prefix + oldBlock.replaceAll("\n", newline) + suffix,
        );
      const proposal = await c.prepare();
      for (const path of ["AGENTS.md", "CLAUDE.md"]) {
        const edit = proposal.files.find((f) => f.path === path)!;
        expect(edit.before).toContain("Use OpenSpec for behavioral changes:");
        expect(edit.after.startsWith(prefix)).toBe(true);
        expect(edit.after.endsWith(suffix)).toBe(true);
        expect(edit.after).toContain("Before every development prompt");
        expect(edit.after.split(start)).toHaveLength(2);
        if (newline === "\r\n")
          expect(edit.after.replaceAll("\r\n", "")).not.toContain("\n");
      }
      await c.specs.apply(c.project, proposal.id);
      expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
    },
  );

  it("preserves custom native files and Cursor metadata while appending missing guidance once", async () => {
    const c = await fixture();
    const originals = new Map(
      paths.map((path) => [
        path,
        path.endsWith(".mdc")
          ? "---\ndescription: Team scope\nglobs: src/**\nalwaysApply: false\n---\nKeep this custom rule."
          : `# Custom ${path}\nKeep this text exactly.`,
      ]),
    );
    for (const [path, content] of originals) await c.write(path, content);
    const prepared = await c.projects.setupFiles(c.project);
    for (const path of paths)
      expect(
        prepared.inspection.docs.find((d) => d.path === path)?.content,
      ).toBe(originals.get(path));
    const proposal = await c.specs.propose(
      c.project,
      "Setup",
      prepared.files,
      "setup",
    );
    await c.specs.apply(c.project, proposal.id);
    for (const [path, original] of originals) {
      const content = await readFile(join(c.root, path), "utf8");
      expect(content.startsWith(original)).toBe(true);
      expect(content.split(start)).toHaveLength(2);
    }
    expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
  });

  it.each([
    `${start}\nOur reviewed custom workflow.\n${end}`,
    `${start}\nUnfinished user edit.`,
    `User edit with only a closing marker.\n${end}`,
    `${oldBlock}\n${oldBlock}`,
  ])(
    "preserves customized or ambiguous managed blocks: %s",
    async (content) => {
      const c = await fixture();
      await c.write("AGENTS.md", content);
      const proposal = await c.prepare();
      expect(proposal.files.map((f) => f.path)).not.toContain("AGENTS.md");
      await c.specs.apply(c.project, proposal.id);
      expect(await readFile(join(c.root, "AGENTS.md"), "utf8")).toBe(content);
      expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
    },
  );

  it("rejects the entire setup when Copilot instructions change after review", async () => {
    const c = await fixture();
    const proposal = await c.prepare();
    await c.write(
      ".github/copilot-instructions.md",
      "External editor's rule.\n",
    );
    await expect(c.specs.apply(c.project, proposal.id)).rejects.toThrow(
      "changed outside",
    );
    expect(
      await readFile(join(c.root, ".github/copilot-instructions.md"), "utf8"),
    ).toBe("External editor's rule.\n");
    expect(await readdir(c.root)).toEqual([".github"]);
  });

  it("rejects symbolic instruction directories and unsupported setup paths", async () => {
    const c = await fixture();
    const outside = await tempDir();
    cleanups.push(() => rm(outside, { recursive: true, force: true }));
    await symlink(outside, join(c.root, ".github"));
    await expect(c.projects.setupFiles(c.project)).rejects.toThrow("Symbolic");
    expect(await readdir(outside)).toEqual([]);
    for (const path of [
      ".github/workflows/run.yml",
      ".cursor/settings.json",
      ".cursor/rules/other.mdc",
      "agent.md",
      "../AGENTS.md",
    ])
      await expect(
        c.specs.propose(c.project, "Unsafe", [{ path, after: "No" }], "setup"),
      ).rejects.toThrow("outside its change");
    expect(await readdir(c.root)).toEqual([".github"]);
  });
});
