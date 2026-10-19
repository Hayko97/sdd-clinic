import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inventoryProject } from "../src/server/project-inventory.js";
import { setupOverview } from "../src/server/setup-overview.js";
import { terminalSetup } from "../src/server/terminal-setup.js";
import type { EngineAdapter, EngineRequest } from "../src/shared/types.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "clinic-overview-"));
  roots.push(root);
  const project = join(root, "project");
  await mkdir(project);
  return { root, project };
}
it("bounds selected source text, excludes dependencies and preserves current specification intent", async () => {
  const { project } = await fixture();
  await writeFile(
    join(project, "README.md"),
    "# Shop\nVisitors browse active products.\n",
  );
  await mkdir(join(project, "src"));
  for (let i = 0; i < 100; i++)
    await writeFile(
      join(project, `src/file${i}.ts`),
      "export const value=1;\n".repeat(3000),
    );
  await mkdir(join(project, "node_modules/pkg"), { recursive: true });
  await writeFile(
    join(project, "node_modules/pkg/index.js"),
    "DO_NOT_ANALYZE_DEPENDENCY",
  );
  await mkdir(join(project, "openspec/specs/catalog"), { recursive: true });
  const intent = "# Existing catalog specification\n";
  await writeFile(join(project, "openspec/specs/catalog/spec.md"), intent);
  const inventory = await inventoryProject({ path: project });
  const overview = setupOverview(inventory);
  expect(
    overview.reduce((n, c) => n + c.content.length, 0),
  ).toBeLessThanOrEqual(36000);
  expect(overview.length).toBeLessThanOrEqual(25);
  expect(
    overview.find((c) => c.path === "openspec/specs/catalog/spec.md")?.content,
  ).toBe(intent);
  expect(overview.some((c) => c.path === "README.md")).toBe(true);
  expect(JSON.stringify(overview)).not.toContain("DO_NOT_ANALYZE_DEPENDENCY");
  expect(inventory.excluded.some((e) => e.path === "node_modules")).toBe(true);
});
it("requires deep analysis when current specification intent exceeds the context budget", () => {
  expect(() =>
    setupOverview({
      files: [
        {
          path: "openspec/specs/large/spec.md",
          content: "x".repeat(36001),
          hash: "fixture",
          lines: 1,
        },
      ],
      excluded: [],
      fingerprint: "fixture",
    }),
  ).toThrow("--deep");
});
it("default setup creates real specs directly in one inference call without source batches", async () => {
  const { root, project } = await fixture();
  await writeFile(
    join(project, "README.md"),
    "# Shop\nVisitors can browse active products; inactive products are hidden.\n",
  );
  await mkdir(join(project, "src"));
  for (let i = 0; i < 50; i++)
    await writeFile(
      join(project, `src/item${i}.ts`),
      "export const item=1;\n".repeat(1200),
    );
  const calls: EngineRequest[] = [];
  let output = "";
  const provider: EngineAdapter = {
    probe: async () => ({
      installed: true,
      compatible: true,
      authenticated: true,
      capabilities: [],
      detail: "fixture",
    }),
    setupModels: async () => [
      { model: "gpt-6.1-sol", name: "Fixture", efforts: ["medium"] },
    ],
    run: async (_path, r) => {
      calls.push(r);
      return {
        sessionId: "fixture",
        text: JSON.stringify({
          summary: "Initial catalog specifications",
          capabilities: [
            {
              name: "catalog",
              purpose:
                "Allow shop visitors to discover active products while excluding inactive catalog entries.",
              requirements: [
                {
                  name: "Browse active products",
                  statement:
                    "The shop SHALL show only active products in the catalog.",
                  basis: "documented",
                  sources: [{ path: "README.md", startLine: 2, endLine: 2 }],
                  scenarios: [
                    {
                      name: "Browse catalog",
                      when: "active and inactive products exist",
                      then: "only active products appear",
                    },
                  ],
                },
              ],
            },
          ],
          reused: [],
          questions: [],
        }),
      };
    },
  };
  await terminalSetup(
    {
      path: project,
      engine: "codex",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    },
    {
      dataDir: join(root, "state"),
      signal: new AbortController().signal,
      providers: { codex: provider, claude: provider },
      io: {
        write: (s) => {
          output += s;
        },
        ask: async () => "yes",
      },
    },
  );
  const validation = await readFile(
    join(project, "openspec/specs/catalog/validation.md"),
    "utf8",
  );
  expect(validation).toContain("Requirement: Browse active products");
  expect(validation).toContain("Scenario: Browse catalog");
  expect(validation).toContain("active and inactive products exist");
  expect(validation).toContain("only active products appear");
  expect(validation).toContain("Status: UNVERIFIED");
  expect(validation).toContain("exact reconstruction");
  expect(await readFile(join(project, "src/item0.ts"), "utf8")).toBe(
    "export const item=1;\n".repeat(1200),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].prompt).toContain("CLINIC_BASELINE_SYNTHESIZE");
  expect(calls[0].prompt).not.toContain("CLINIC_BASELINE_ANALYZE");
  expect(output).not.toContain("Analyzing batch");
  expect(output).toContain("Creating initial specifications directly");
  expect(
    await readFile(join(project, "openspec/specs/catalog/spec.md"), "utf8"),
  ).toContain("### Requirement: Browse active products");
  expect(
    await readFile(
      join(project, "openspec/project/baseline-analysis.md"),
      "utf8",
    ),
  ).toContain("No exhaustive source audit was performed");
});
