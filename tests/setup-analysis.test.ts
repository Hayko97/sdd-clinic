import { afterEach, expect, it } from "vitest";
import {
  mkdir,
  chmod,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/vault.js";
import { adapters } from "../src/server/engines.js";
import {
  inventoryProject,
  sourceChunks,
} from "../src/server/project-inventory.js";
import type {
  EngineAdapter,
  EngineKind,
  EngineRequest,
  Proposal,
} from "../src/shared/types.js";
import { git, tempDir, waitRun } from "./helpers.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const source = "packages/shop/src/features/products/internal/catalog.ts";
const capability = (
  sources: { path: string; startLine: number; endLine: number }[],
) => ({
  name: "catalog",
  purpose: "Let visitors find the active products available in the catalog.",
  requirements: [
    {
      name: "Active product listing",
      statement: "The catalog SHALL return only active products.",
      basis: "inferred",
      sources,
      scenarios: [
        {
          name: "List active products",
          when: "products include active and inactive entries",
          then: "only active products are returned",
        },
        {
          name: "Empty catalog",
          when: "no active products exist",
          then: "the listing is empty",
        },
      ],
    },
    {
      name: "Catalog availability",
      statement: "The catalog SHALL support listing an empty collection.",
      basis: "inferred",
      sources,
      scenarios: [
        {
          name: "Empty collection",
          when: "the collection is empty",
          then: "listing returns an empty result",
        },
      ],
    },
  ],
});
async function fixture(engine: EngineKind = "codex") {
  const root = await tempDir();
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await mkdir(repo);
  const calls: EngineRequest[] = [];
  let behavior:
    | "valid"
    | "missing"
    | "invalid-reference"
    | "malformed"
    | "empty"
    | "reuse"
    | "hang"
    | "bulk-notes"
    | "overwrite" = "valid";
  let during: (() => Promise<void>) | undefined;
  const provider: EngineAdapter = {
    probe: adapters.codex.probe,
    async run(_path, request) {
      calls.push(request);
      if (during) {
        const action = during;
        during = undefined;
        await action();
      }
      if (behavior === "hang")
        await new Promise((_, reject) => {
          if (request.signal.aborted) reject(new Error("Canceled"));
          else
            request.signal.addEventListener(
              "abort",
              () => reject(new Error("Canceled")),
              { once: true },
            );
        });
      if (behavior === "malformed")
        return { sessionId: "fixture", text: "not JSON" };
      if (request.prompt.includes("CLINIC_BASELINE_CONSOLIDATE")) {
        const group = JSON.parse(request.prompt.split("FINDINGS\n").at(-1)!);
        return {
          sessionId: "fixture",
          text: JSON.stringify({
            notes: [
              {
                text: "Consolidated catalog behavior.",
                sources: group[0].sources,
              },
            ],
            questions: [],
          }),
        };
      }
      if (request.prompt.includes("CLINIC_BASELINE_ANALYZE")) {
        const chunks = JSON.parse(
          request.prompt.split("SOURCE_CHUNKS\n").at(-1)!,
        );
        if (behavior === "bulk-notes")
          return {
            sessionId: "fixture",
            text: JSON.stringify({
              reviewedChunks: chunks.map((c: any) => c.id),
              notes: Array.from({ length: 40 }, () => ({
                text: "Catalog behavior. ".repeat(160),
                sources: [{ path: source, startLine: 1, endLine: 1 }],
              })),
              questions: [],
            }),
          };
        return {
          sessionId: "fixture",
          text: JSON.stringify({
            reviewedChunks:
              behavior === "missing" ? [] : chunks.map((c: any) => c.id),
            notes: chunks
              .filter((c: any) => c.path === source)
              .map((c: any) => ({
                text: "Active products are listed; docs and code need reconciliation.",
                sources: [
                  { path: c.path, startLine: c.startLine, endLine: c.endLine },
                ],
              })),
            questions: [
              "Documentation describes inactive products too; confirm the intended filter.",
            ],
          }),
        };
      }
      const notes = JSON.parse(request.prompt.split("FINDINGS\n").at(-1)!);
      const sources = notes.flatMap((n: any) => n.sources);
      return {
        sessionId: "fixture",
        text: JSON.stringify({
          summary: "Existing catalog behavior inferred for owner review.",
          capabilities:
            ["empty", "reuse"].includes(behavior) || !sources.length
              ? []
              : [
                  capability(
                    behavior === "invalid-reference"
                      ? [{ path: source, startLine: 999999, endLine: 999999 }]
                      : sources,
                  ),
                ],
          reused:
            behavior === "reuse"
              ? [
                  {
                    path: "openspec/specs/catalog/spec.md",
                    reason: "Existing capability already describes the filter.",
                  },
                ]
              : [],
          questions: [],
        }),
      };
    },
  };
  const app = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
    providers: { codex: provider, claude: provider },
  });
  cleanups.push(() => app.app.close());
  app.store.put("engine", { id: engine, path: "fixture", connected: true });
  const project = await app.projects.add(repo, engine, "Existing store");
  const session = await app.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: app.bootstrapToken },
  });
  const headers = { cookie: `clinic_session=${session.cookies[0]!.value}` };
  const write = async (path: string, content: string | Buffer) => {
    await mkdir(dirname(join(repo, path)), { recursive: true });
    await writeFile(join(repo, path), content);
  };
  await write(
    source,
    "export const active = products => products.filter(product => product.active);\n",
  );
  await write(
    "docs/catalog.md",
    "# Catalog\nDocumentation says all products are visible. Confirm the rule.\n",
  );
  async function analyze() {
    const run = await app.runs.setupAnalysis(project);
    const done = await waitRun(app.store, run.id, 30000);
    return {
      done,
      proposal: done.proposalId
        ? app.store.require<Proposal>("proposal", done.proposalId)
        : undefined,
    };
  }
  return {
    ...app,
    root,
    repo,
    project,
    headers,
    calls,
    write,
    analyze,
    setBehavior: (next: typeof behavior) => (behavior = next),
    during: (fn: () => Promise<void>) => (during = fn),
  };
}

it.each(["codex", "claude"] as const)(
  "deeply analyzes complete nested text using %s and applies a reviewed baseline plus agent files",
  async (engine) => {
    const c = await fixture(engine);
    await c.write(
      "docs/long-guide.md",
      "Reference details.\n".repeat(4000) + "TAIL_BEHAVIOR_MUST_BE_ANALYZED\n",
    );
    const before = await inventoryProject(c.project);
    const { done, proposal } = await c.analyze();
    expect(done.status, done.error).toBe("completed");
    expect(proposal?.source).toBe("baseline");
    expect(proposal?.inventoryHash).toBe(before.fingerprint);
    expect(
      c.calls.every(
        (call) =>
          call.mode === "read-only" &&
          call.tools?.length === 0 &&
          !call.mcp &&
          call.cwd !== c.repo,
      ),
    ).toBe(true);
    const batches = c.calls
      .filter((call) => call.prompt.includes("CLINIC_BASELINE_ANALYZE"))
      .flatMap((call) =>
        JSON.parse(call.prompt.split("SOURCE_CHUNKS\n").at(-1)!),
      );
    expect(batches).toHaveLength(sourceChunks(before.files).length);
    expect(
      batches
        .filter((b: any) => b.path === "docs/long-guide.md")
        .map((b: any) => b.content)
        .join(""),
    ).toBe(before.files.find((f) => f.path === "docs/long-guide.md")!.content);
    expect(
      c.calls.some((call) =>
        call.prompt.includes("TAIL_BEHAVIOR_MUST_BE_ANALYZED"),
      ),
    ).toBe(true);
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md",
      ".cursor/rules/sdd-clinic.mdc",
      "openspec/specs/catalog/spec.md",
      "openspec/specs/catalog/validation.md",
      "openspec/project/baseline-analysis.md",
    ])
      expect(proposal!.files.map((f) => f.path)).toContain(path);
    await expect(readFile(join(c.repo, "AGENTS.md"))).rejects.toThrow();
    const report = proposal!.files.find((f) =>
      f.path.endsWith("baseline-analysis.md"),
    )!.after;
    expect(report).toContain(source);
    expect(report).toContain("Documentation describes inactive products too");
    expect(report).toContain("No implementation or tests were executed");
    await c.specs.apply(c.project, proposal!.id);
    expect(
      await readFile(join(c.repo, "openspec/specs/catalog/spec.md"), "utf8"),
    ).toContain("Inferred baseline");
    expect(
      (await c.specs.list(c.project)).some(
        (f) => f.kind === "spec" && f.name === "catalog",
      ),
    ).toBe(true);
    const validation = await readFile(
      join(c.repo, "openspec/specs/catalog/validation.md"),
      "utf8",
    );
    for (const requirement of capability([]).requirements) {
      expect(validation).toContain(`Requirement: ${requirement.name}`);
      for (const scenario of requirement.scenarios) {
        expect(validation).toContain(`Scenario: ${scenario.name}`);
        expect(validation).toContain(scenario.when);
        expect(validation).toContain(scenario.then);
      }
    }
    expect(validation).toContain("Status: UNVERIFIED");
    expect((await c.projects.setupFiles(c.project)).files).toEqual([]);
    expect(await readFile(join(c.repo, source), "utf8")).toContain(
      "products.filter",
    );
  },
);

it("excludes ignored/generated/credential/binary/symlink content and redacts source evidence", async () => {
  const c = await fixture();
  await git(c.repo, ["init", "-b", "main"]);
  await c.write(".gitignore", "private-notes/\n");
  for (const path of [
    ".env",
    ".aws/credentials",
    "node_modules/library/index.js",
    "dist/output.js",
    "private-notes/draft.md",
  ])
    await c.write(path, "EXCLUDED_PRIVATE_VALUE");
  await c.write("image.bin", Buffer.from([0, 1, 2, 3]));
  await c.write("config.ts", 'const api_key = "SECRET_VALUE";\n');
  await symlink(join(c.root, "state"), join(c.repo, "outside"));
  const inventory = await inventoryProject(c.project);
  expect(inventory.excluded.map((f) => f.reason)).toEqual(
    expect.arrayContaining([
      "credential file or directory",
      "dependency, generated output or internal data directory",
      "Git-ignored path",
      "binary or non-UTF-8 file",
      "symbolic link",
    ]),
  );
  expect(inventory.files.map((f) => f.content).join("\n")).not.toContain(
    "SECRET_VALUE",
  );
  expect((await c.analyze()).done.status).toBe("completed");
  expect(c.calls.map((call) => call.prompt).join("\n")).not.toMatch(
    /SECRET_VALUE|EXCLUDED_PRIVATE_VALUE/,
  );
  await expect(
    inventoryProject(c.project, undefined, {
      entries: 1,
      fileBytes: 2000000,
      totalBytes: 20000000,
    }),
  ).rejects.toThrow("exceeds 1 entries");
  await expect(
    inventoryProject(c.project, undefined, {
      entries: 30000,
      fileBytes: 10,
      totalBytes: 20000000,
    }),
  ).rejects.toThrow("analysis limit");
});

it.each(["edit", "add", "delete", "target"])(
  "rejects the entire baseline after a source/target %s",
  async (action) => {
    const c = await fixture();
    const { done, proposal } = await c.analyze();
    expect(done.status, done.error).toBe("completed");
    if (action === "edit") await c.write(source, "Changed code\n");
    if (action === "add") await c.write("new-feature.ts", "New behavior\n");
    if (action === "delete") await rm(join(c.repo, source));
    if (action === "target")
      await c.write("AGENTS.md", "Owner's external rule\n");
    await expect(c.specs.apply(c.project, proposal!.id)).rejects.toThrow(
      /changed outside/,
    );
    await expect(
      readFile(join(c.repo, "openspec/specs/catalog/spec.md")),
    ).rejects.toThrow();
    await expect(readFile(join(c.repo, "CLAUDE.md"))).rejects.toThrow();
  },
);

it.each(["missing", "invalid-reference", "malformed"] as const)(
  "fails closed for %s provider output",
  async (behavior) => {
    const c = await fixture();
    c.setBehavior(behavior);
    const { done, proposal } = await c.analyze();
    expect(done.status).toBe("failed");
    expect(done.error).toBeTruthy();
    expect(proposal).toBeUndefined();
    expect(c.store.list("proposal", c.project.id)).toHaveLength(0);
    await expect(readFile(join(c.repo, "AGENTS.md"))).rejects.toThrow();
  },
);

it("rejects source changes during provider analysis", async () => {
  const c = await fixture();
  c.during(() => c.write("docs/catalog.md", "Changed intent"));
  const { done, proposal } = await c.analyze();
  expect(done.status).toBe("failed");
  expect(done.error).toContain("changed during analysis");
  expect(proposal).toBeUndefined();
});

it("reuses existing specs on repeated setup and preserves customized agent guidance", async () => {
  const c = await fixture();
  const first = await c.analyze();
  await c.specs.apply(c.project, first.proposal!.id);
  const original = await readFile(
    join(c.repo, "openspec/specs/catalog/spec.md"),
    "utf8",
  );
  await c.write("AGENTS.md", "Custom owner rules\n");
  c.setBehavior("reuse");
  const repeated = await c.analyze();
  expect(repeated.done.status, repeated.done.error).toBe("completed");
  expect(
    repeated.proposal!.files.some((f) => f.path.startsWith("openspec/specs/")),
  ).toBe(false);
  await c.specs.apply(c.project, repeated.proposal!.id);
  expect(
    await readFile(join(c.repo, "openspec/specs/catalog/spec.md"), "utf8"),
  ).toBe(original);
  expect(await readFile(join(c.repo, "AGENTS.md"), "utf8")).toContain(
    "Custom owner rules",
  );
  c.setBehavior("overwrite");
  expect((await c.analyze()).done.error).toContain("cannot overwrite");
  await expect(
    c.specs.propose(
      c.project,
      "unsafe",
      [{ path: "src/app.ts", after: "write" }],
      "baseline",
    ),
  ).rejects.toThrow("outside");
  await expect(
    c.specs.propose(
      c.project,
      "overwrite",
      [{ path: "openspec/specs/catalog/spec.md", after: "overwrite" }],
      "baseline",
    ),
  ).rejects.toThrow("cannot overwrite");
});

it("reports an empty repository without inventing a capability", async () => {
  const c = await fixture();
  await rm(c.repo, { recursive: true });
  await mkdir(c.repo);
  c.setBehavior("empty");
  const { done, proposal } = await c.analyze();
  expect(done.status, done.error).toBe("completed");
  expect(
    proposal!.files.some((f) => f.path.startsWith("openspec/specs/")),
  ).toBe(false);
  expect(
    proposal!.files.find((f) => f.path.endsWith("baseline-analysis.md"))!.after,
  ).toContain("0 eligible text files");
  expect(c.calls).toHaveLength(1);
});

it("cancels analysis, rejects concurrent runs and preserves restart interruption", async () => {
  const c = await fixture();
  c.setBehavior("hang");
  const run = await c.runs.setupAnalysis(c.project);
  await expect(c.runs.setupAnalysis(c.project)).rejects.toThrow(
    "already active",
  );
  c.runs.cancel(run.id);
  expect((await waitRun(c.store, run.id)).status).toBe("interrupted");
  expect(c.store.list("proposal", c.project.id)).toHaveLength(0);
  c.store.put("run", { ...run, id: "restart-fixture", status: "running" });
  c.store.recover();
  expect(c.runs.get("restart-fixture").status).toBe("interrupted");
  expect(c.runs.get("restart-fixture").error).toContain("resume explicitly");
});

it("keeps provider-free and files-only setup explicit and requires the configured engine", async () => {
  const c = await fixture();
  const endpoint = `/api/projects/${c.project.id}/setup`;
  const files = await c.app.inject({
    method: "POST",
    url: endpoint,
    headers: c.headers,
    payload: { mode: "files" },
  });
  expect(files.statusCode).toBe(200);
  expect(files.json().analysisMessage).toContain("were not generated");
  expect(files.json().proposal.source).toBe("setup");
  c.store.put("engine", { id: "codex", path: "fixture", connected: false });
  c.store.put("engine", { id: "claude", path: "fixture", connected: true });
  const offline = await c.app.inject({
    method: "POST",
    url: endpoint,
    headers: c.headers,
    payload: {},
  });
  expect(offline.json().analysisMessage).toContain("Connect codex");
  expect(offline.json().run).toBeUndefined();
  const explicit = await c.app.inject({
    method: "POST",
    url: endpoint,
    headers: c.headers,
    payload: { mode: "analyze" },
  });
  expect(explicit.statusCode).toBe(400);
  expect(c.calls).toHaveLength(0);
});

it("consolidates large findings before synthesis and keeps source references", async () => {
  const c = await fixture();
  c.setBehavior("bulk-notes");
  const { done, proposal } = await c.analyze();
  expect(done.status, done.error).toBe("completed");
  expect(
    c.calls.some((call) => call.prompt.includes("CLINIC_BASELINE_CONSOLIDATE")),
  ).toBe(true);
  expect(
    proposal!.files.find((f) => f.path === "openspec/specs/catalog/spec.md")!
      .after,
  ).toContain(source);
});

it("preserves a custom baseline report and fails visibly when evidence cannot be read", async () => {
  const c = await fixture();
  await c.write(
    "openspec/project/baseline-analysis.md",
    "Owner's custom baseline document.\n",
  );
  const { done } = await c.analyze();
  expect(done.status).toBe("failed");
  expect(done.error).toContain("customized");
  expect(
    await readFile(
      join(c.repo, "openspec/project/baseline-analysis.md"),
      "utf8",
    ),
  ).toBe("Owner's custom baseline document.\n");
  if (process.getuid?.() !== 0) {
    const path = join(c.repo, source);
    await chmod(path, 0);
    try {
      await expect(inventoryProject(c.project)).rejects.toThrow(
        "Cannot analyze",
      );
    } finally {
      await chmod(path, 0o644);
    }
  }
});

it("preserves an existing validation companion and rejects the conflicting baseline before writes", async () => {
  const c = await fixture();
  const path = "openspec/specs/catalog/validation.md";
  await c.write(path, "Owner validation plan\n");
  const result = await c.analyze();
  expect(result.done.status).toBe("failed");
  expect(result.done.error).toContain(`cannot overwrite ${path}`);
  expect(result.proposal).toBeUndefined();
  expect(await readFile(join(c.repo, path), "utf8")).toBe(
    "Owner validation plan\n",
  );
  await expect(
    readFile(join(c.repo, "openspec/specs/catalog/spec.md")),
  ).rejects.toThrow();
});

it("allows companions for the maximum baseline capability count", async () => {
  const c = await fixture();
  const files = Array.from({ length: 60 }, (_, i) =>
    ["spec", "validation"].map((name) => ({
      path: `openspec/specs/capability-${i}/${name}.md`,
      after: "Fixture document",
    })),
  ).flat();
  const proposal = await c.specs.propose(
    c.project,
    "Large baseline",
    files,
    "baseline",
  );
  expect(proposal.files).toHaveLength(120);
});
