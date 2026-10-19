import { qualityFixture } from "./setup-quality-fixture.js";
import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { terminalSetup } from "../src/server/terminal-setup.js";
import {
  reconstructionAreas,
  reconstructionPath,
} from "../src/server/reconstruction.js";
import type { EngineAdapter } from "../src/shared/types.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture(invalid?: "missing" | "citation") {
  const root = await mkdtemp(join(tmpdir(), "clinic-rebuild-"));
  roots.push(root);
  const project = join(root, "project");
  await mkdir(project);
  const source =
    "# Catalog\nReturns active products with string id and name fields; an empty list is valid.\n";
  await writeFile(join(project, "README.md"), source);
  const sources = [{ path: "README.md", startLine: 2, endLine: 2 }];
  let synthesisCalls = 0;
  const prompts: string[] = [];
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
    run: async (_path, request) => {
      prompts.push(request.prompt);
      if (request.prompt.includes("CLINIC_SETUP_QUALITY"))
        return {
          sessionId: "quality-fixture",
          text: JSON.stringify(qualityFixture(request.prompt)),
        };
      expect(request.reasoning).toBe("medium");
      let result: unknown;
      if (request.prompt.includes("CLINIC_RECONSTRUCTION_SYNTHESIZE")) {
        synthesisCalls++;
        const areas: Record<string, unknown> = Object.fromEntries(
          reconstructionAreas.map((name) => [
            name,
            {
              status: "captured",
              details:
                "The catalog returns a list of active products containing string id and name fields; no active products produces an empty list.",
              sources,
              gaps: [],
            },
          ]),
        );
        areas.presentation = {
          status: "unknown",
          details:
            "The supplied evidence does not define screen layout or provide visual assets needed to reproduce the interface.",
          sources: [],
          gaps: ["Provide reference screens and required assets."],
        };
        if (invalid === "missing") delete areas.data;
        if (invalid === "citation")
          areas.data = {
            status: "captured",
            details:
              "The supplied data fields have string values and require stable identifiers for each active catalog product.",
            sources: [{ path: "README.md", startLine: 1, endLine: 1 }],
            gaps: [],
          };
        result = { areas };
      } else if (request.prompt.includes("CLINIC_BASELINE_ANALYZE")) {
        const chunks = JSON.parse(
          request.prompt.split("SOURCE_CHUNKS\n").at(-1)!,
        );
        result = {
          reviewedChunks: chunks.map((c: { id: string }) => c.id),
          notes: [{ text: source, sources }],
          questions: [],
        };
      } else
        result = {
          summary: "Catalog baseline",
          capabilities: [
            {
              name: "catalog",
              purpose:
                "Allow visitors to discover active products with stable identifiers and readable names.",
              requirements: [
                {
                  name: "List active products",
                  statement:
                    "The catalog SHALL return active products with string id and name fields.",
                  basis: "documented",
                  sources,
                  scenarios: [
                    {
                      name: "Empty listing",
                      when: "no active products exist",
                      then: "the result is an empty list",
                    },
                  ],
                },
              ],
            },
          ],
          reused: [],
          questions: [],
        };
      return { sessionId: "fixture", text: JSON.stringify(result) };
    },
  };
  const run = () =>
    terminalSetup(
      {
        path: project,
        rebuild: true,
        engine: "codex",
        model: "gpt-6.1-sol",
        reasoning: "medium",
      },
      {
        dataDir: join(root, "state"),
        signal: new AbortController().signal,
        providers: { codex: provider, claude: provider },
        io: { write: () => {}, ask: async () => "yes" },
      },
    );
  return { project, source, run, prompts, calls: () => synthesisCalls };
}
it("creates a reconstruction guide, native specs and validation plans while preserving source", async () => {
  const f = await fixture();
  expect(await f.run()).toBe("applied");
  const guide = await readFile(join(f.project, reconstructionPath), "utf8");
  for (const area of reconstructionAreas) expect(guide).toContain(`## ${area}`);
  expect(guide).toContain("Provide reference screens and required assets.");
  expect(guide).toContain("Status: UNVERIFIED");
  expect(guide).toContain("separate empty repository");
  expect(guide).toContain("openspec/specs/catalog/spec.md");
  expect(
    await readFile(
      join(f.project, "openspec/specs/catalog/validation.md"),
      "utf8",
    ),
  ).toContain("Empty listing");
  expect(await readFile(join(f.project, "README.md"), "utf8")).toBe(f.source);
  expect(f.calls()).toBe(1);
  expect(
    f.prompts.find((p) => p.includes("CLINIC_BASELINE_ANALYZE")),
  ).toContain("data fields/defaults/constraints");
});
it.each(["missing", "citation"] as const)(
  "rejects %s reconstruction evidence after bounded correction with no writes",
  async (invalid) => {
    const f = await fixture(invalid);
    await expect(f.run()).rejects.toThrow(
      "invalid after 2 correction attempts",
    );
    expect(f.calls()).toBe(3);
    await expect(
      readFile(join(f.project, reconstructionPath)),
    ).rejects.toThrow();
    await expect(
      readFile(join(f.project, "openspec/specs/catalog/spec.md")),
    ).rejects.toThrow();
    expect(await readFile(join(f.project, "README.md"), "utf8")).toBe(f.source);
  },
);
it("preserves customized reconstruction guides before inference", async () => {
  const f = await fixture();
  await mkdir(join(f.project, "openspec/project"), { recursive: true });
  await writeFile(
    join(f.project, reconstructionPath),
    "Custom reconstruction plan\n",
  );
  await expect(f.run()).rejects.toThrow("customized reconstruction guide");
  expect(f.prompts).toHaveLength(0);
  expect(await readFile(join(f.project, reconstructionPath), "utf8")).toBe(
    "Custom reconstruction plan\n",
  );
});
