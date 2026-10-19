import { vi } from "vitest";
import { Projects } from "../src/server/projects.js";
import { afterEach, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { terminalSetup } from "../src/server/terminal-setup.js";
import {
  completeSetupDocuments,
  validationFromSpec,
} from "../src/server/setup-documents.js";
const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0))
    await rm(r, { recursive: true, force: true });
});
const spec =
  "# Catalog Specification\n\n## Purpose\nVisitors browse available products.\n\n## Requirements\n### Requirement: Browse catalog\nThe system SHALL show available products.\n\n#### Scenario: Available products\n- **WHEN** a visitor opens the catalog\n- **THEN** available products are displayed\n";
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "clinic-repair-"));
  roots.push(root);
  const project = join(root, "project");
  await mkdir(join(project, "openspec/specs/catalog"), { recursive: true });
  await writeFile(join(project, "openspec/specs/catalog/spec.md"), spec);
  await writeFile(join(project, "app.ts"), "unchanged source");
  return { root, project };
}
it("repairs spec-only projects without a provider or source audit and is idempotent", async () => {
  const { root, project } = await fixture();
  // Ordinary inventory would reject this >20MB authored file. Repair must not read it.
  await writeFile(join(project, "large.txt"), "x".repeat(21_000_000));
  let output = "";
  const run = () =>
    terminalSetup(
      { path: project, repair: true },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        io: {
          write: (t) => {
            output += t;
          },
          ask: async () => "yes",
        },
        providers: {} as any,
      },
    );
  expect(await run()).toBe("applied");
  const validation = await readFile(
    join(project, "openspec/specs/catalog/validation.md"),
    "utf8",
  );
  expect(validation).toContain("Available products");
  expect(validation).toContain("available products are displayed");
  expect(validation).toContain("UNVERIFIED");
  for (const path of [
    "CHANGELOG.md",
    "openspec/project/workflow.md",
    "openspec/schemas/clinic-sdd/templates/tasks.md",
    ".clinic/skills/implement-spec/SKILL.md",
  ])
    expect(await readFile(join(project, path), "utf8")).not.toBe("");
  expect(await run()).toBe("unchanged");
  expect(await readFile(join(project, "app.ts"), "utf8")).toBe(
    "unchanged source",
  );
  expect(
    await readFile(join(project, "openspec/specs/catalog/spec.md"), "utf8"),
  ).toBe(spec);
  expect(output).toContain("no provider or source analysis");
});
it.each(["CHANGELOG.md", "changelog.md", "ChangeLog.md"])(
  "preserves %s and custom validation",
  async (name) => {
    const { project } = await fixture();
    await writeFile(join(project, name), "custom history");
    await writeFile(
      join(project, "openspec/specs/catalog/validation.md"),
      "custom checks",
    );
    const result = await completeSetupDocuments(project, []);
    expect(result.files).toEqual([]);
    expect(result.preserved).toContain("openspec/specs/catalog/validation.md");
  },
);
it("refuses stale spec inputs before any repair writes", async () => {
  const { root, project } = await fixture();
  await expect(
    terminalSetup(
      { path: project, repair: true },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        io: {
          write: () => {},
          ask: async () => {
            await writeFile(
              join(project, "openspec/specs/catalog/spec.md"),
              spec + "\nExternal change",
            );
            return "yes";
          },
        },
        providers: {} as any,
      },
    ),
  ).rejects.toThrow("Context changed");
  expect(await readdir(project)).not.toContain("CHANGELOG.md");
  await expect(
    readFile(join(project, "openspec/specs/catalog/validation.md")),
  ).rejects.toThrow();
});
it("declined repair writes nothing", async () => {
  const { root, project } = await fixture();
  expect(
    await terminalSetup(
      { path: project, repair: true },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        io: { write: () => {}, ask: async () => "no" },
        providers: {} as any,
      },
    ),
  ).toBe("declined");
  expect(await readdir(project)).not.toContain("CHANGELOG.md");
});
it("rejects malformed scenarios rather than inventing checks", () => {
  expect(() =>
    validationFromSpec("spec.md", spec.replace("**THEN**", "**AND**")),
  ).toThrow("WHEN and THEN");
});
it("adds validation for generated GUI specifications", async () => {
  const { project } = await fixture();
  const result = await completeSetupDocuments(project, [
    { path: "openspec/specs/new-feature/spec.md", after: spec },
  ]);
  expect(result.files.map((f) => f.path)).toContain(
    "openspec/specs/new-feature/validation.md",
  );
});

it("rejects a newly appeared changelog before applying any repair file", async () => {
  const { root, project } = await fixture();
  await expect(
    terminalSetup(
      { path: project, repair: true },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        io: {
          write: () => {},
          ask: async () => {
            await writeFile(join(project, "changelog.md"), "new owner history");
            return "yes";
          },
        },
        providers: {} as any,
      },
    ),
  ).rejects.toThrow("changelog appeared");
  expect(await readFile(join(project, "changelog.md"), "utf8")).toBe(
    "new owner history",
  );
  await expect(
    readFile(join(project, "openspec/specs/catalog/validation.md")),
  ).rejects.toThrow();
});
it("directs a project with no specifications to initial setup without writing a fake baseline", async () => {
  const { root, project } = await fixture();
  await rm(join(project, "openspec"), { recursive: true });
  await expect(
    terminalSetup(
      { path: project, repair: true },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        io: { write: () => {}, ask: async () => "yes" },
        providers: {} as any,
      },
    ),
  ).rejects.toThrow("No capability specifications exist");
  expect(await readdir(project)).toEqual(["app.ts"]);
});

it.each(["spec", "validation"])(
  "rejects a %s change between rendering and proposing repair",
  async (kind) => {
    const { root, project } = await fixture();
    const original = Projects.prototype.setupFiles;
    const spy = vi
      .spyOn(Projects.prototype, "setupFiles")
      .mockImplementation(async function (this: Projects, ...args) {
        const setup = await original.apply(this, args);
        await writeFile(
          join(project, `openspec/specs/catalog/${kind}.md`),
          kind === "spec"
            ? spec.replace(
                "available products are displayed",
                "a different result is required",
              )
            : "Owner custom checks",
        );
        return setup;
      });
    try {
      await expect(
        terminalSetup(
          { path: project, repair: true },
          {
            dataDir: join(root, "state"),
            signal: new AbortController().signal,
            io: { write: () => {}, ask: async () => "yes" },
            providers: {} as any,
          },
        ),
      ).rejects.toThrow(/changed|Reload/);
      expect(await readdir(project)).not.toContain("CHANGELOG.md");
      if (kind === "validation")
        expect(
          await readFile(
            join(project, "openspec/specs/catalog/validation.md"),
            "utf8",
          ),
        ).toBe("Owner custom checks");
    } finally {
      spy.mockRestore();
    }
  },
);
