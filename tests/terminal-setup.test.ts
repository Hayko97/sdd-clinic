import { qualityFixture } from "./setup-quality-fixture.js";
import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import {
  terminalSetup,
  selectSetupProfile,
} from "../src/server/terminal-setup.js";
import type { EngineAdapter, EngineRequest } from "../src/shared/types.js";
import { command } from "../src/server/util.js";

const inferredCapability = {
  name: "answer-module",
  purpose:
    "Expose the module's documented answer to callers through a stable named export.",
  requirements: [
    {
      name: "Published answer",
      statement: "The module SHALL export the answer value 42.",
      basis: "inferred",
      sources: [{ path: "app.ts", startLine: 1, endLine: 1 }],
      scenarios: [
        {
          name: "Read the answer",
          when: "a caller imports the answer",
          then: "the exported value is 42",
        },
      ],
    },
  ],
};
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "clinic terminal "));
  roots.push(root);
  const path = join(root, "project with spaces");
  await mkdir(path);
  await writeFile(join(path, "app.ts"), "export const answer = 42;\n");
  const calls: EngineRequest[] = [];
  let output = "";
  let hasSpec = false;
  const provider: EngineAdapter = {
    probe: async () => ({
      installed: true,
      compatible: true,
      authenticated: true,
      capabilities: [],
      detail: "fixture",
    }),
    setupModels: async () => [
      { model: "gpt-6.1-sol", name: "Sol", efforts: ["low", "medium", "high"] },
    ],
    run: async (_path, r) => {
      calls.push(r);
      if (r.prompt.includes("CLINIC_SETUP_COVERAGE")) {
        const input = JSON.parse(r.prompt.split("COVERAGE_INPUT\n").at(-1)!);
        return {
          sessionId: "coverage-fixture",
          text: JSON.stringify({
            reviewedChunks: input.chunks.map((c: { id: string }) => c.id),
            blockingIssues: [],
          }),
        };
      }
      if (r.prompt.includes("CLINIC_SETUP_QUALITY"))
        return {
          sessionId: "quality-fixture",
          text: JSON.stringify(qualityFixture(r.prompt)),
        };
      if (r.prompt.includes("CLINIC_BASELINE_ANALYZE")) {
        const chunks = JSON.parse(r.prompt.split("SOURCE_CHUNKS\n").at(-1)!);
        hasSpec ||= chunks.some(
          (c: { path: string }) =>
            c.path === "openspec/specs/answer-module/spec.md",
        );
        return {
          sessionId: "fixture",
          text: JSON.stringify({
            reviewedChunks: chunks.map((c: { id: string }) => c.id),
            notes: chunks
              .filter(
                (c: { path: string; startLine: number }) =>
                  c.path === "app.ts" && c.startLine === 1,
              )
              .map(() => ({
                text: "The module exports answer 42.",
                sources: [{ path: "app.ts", startLine: 1, endLine: 1 }],
              })),
            questions: [],
          }),
        };
      }
      return {
        sessionId: "fixture",
        text: JSON.stringify({
          summary: "Reviewed source-backed answer capability.",
          capabilities: hasSpec ? [] : [inferredCapability],
          reused: hasSpec
            ? [
                {
                  path: "openspec/specs/answer-module/spec.md",
                  reason: "The existing spec describes answer 42.",
                },
              ]
            : [],
          questions: [],
        }),
      };
    },
  };
  const signal = new AbortController();
  const deps = {
    dataDir: join(root, "data"),
    signal: signal.signal,
    providers: { codex: provider, claude: provider },
    io: {
      write: (s: string) => {
        output += s;
      },
      ask: async (q: string): Promise<string> =>
        q.startsWith("Apply")
          ? "yes"
          : q.startsWith("Analyze") || q.startsWith("Generate")
            ? "yes"
            : "",
    },
  };
  return { root, path, calls, provider, deps, signal, output: () => output };
}
it("reviews guidance, preserves custom agents, and repeat setup is idempotent without provider calls", async () => {
  const f = await fixture();
  await mkdir(join(f.path, ".clinic/agents"), { recursive: true });
  const custom = "custom agent content\n";
  await writeFile(join(f.path, ".clinic/agents/custom.yaml"), custom);
  await terminalSetup(
    {
      path: f.path,
      name: "Host project name",
      engine: "codex",
      guidanceOnly: true,
    },
    f.deps,
  );
  expect(await readFile(join(f.path, "AGENTS.md"), "utf8")).toContain("SDD");
  expect(
    parse(await readFile(join(f.path, ".clinic/project.yaml"), "utf8")).name,
  ).toBe("Host project name");
  expect(
    await readFile(join(f.path, ".clinic/agents/custom.yaml"), "utf8"),
  ).toBe(custom);
  await terminalSetup(
    {
      path: f.path,
      name: "Host project name",
      engine: "codex",
      guidanceOnly: true,
    },
    f.deps,
  );
  expect(f.output()).toContain("No setup changes are needed");
  expect(f.calls).toHaveLength(0);
});
it("declining terminal review writes no setup files", async () => {
  const f = await fixture();
  f.deps.io.ask = async () => "no";
  await terminalSetup(
    { path: f.path, engine: "codex", guidanceOnly: true },
    f.deps,
  );
  expect(await readdir(f.path)).toEqual(["app.ts"]);
  expect(f.output()).toContain("not applied");
});
it("rejects source changes during review without partial writes", async () => {
  const f = await fixture();
  f.deps.io.ask = async () => {
    await writeFile(join(f.path, "app.ts"), "changed\n");
    return "yes";
  };
  await expect(
    terminalSetup(
      { path: f.path, engine: "codex", guidanceOnly: true },
      f.deps,
    ),
  ).rejects.toThrow("sources changed");
  expect(await readdir(f.path)).toEqual(["app.ts"]);
});
it("enforces selected model on all analysis stages and saves only a reviewed setup profile", async () => {
  const f = await fixture();
  await mkdir(join(f.path, ".clinic"));
  await writeFile(
    join(f.path, ".clinic/project.yaml"),
    "name: Custom\nengine: codex\ncustom: preserve me\n",
  );
  await terminalSetup(
    {
      deep: true,
      path: f.path,
      engine: "codex",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    },
    f.deps,
  );
  expect(f.calls.length).toBeGreaterThanOrEqual(2);
  expect(
    f.calls.every(
      (r) =>
        r.model === "gpt-6.1-sol" &&
        r.reasoning === "medium" &&
        r.tools?.length === 0,
    ),
  ).toBe(true);
  const config = parse(
    await readFile(join(f.path, ".clinic/project.yaml"), "utf8"),
  );
  expect(config.setup).toEqual({
    engine: "codex",
    model: "gpt-6.1-sol",
    reasoning: "medium",
  });
  expect(config.custom).toBe("preserve me");
  expect(f.output()).toContain("Existing SDD and agent files:");
  expect(f.output()).toContain(".clinic/project.yaml");
});
it("does not inherit saved xhigh and honors explicit supported overrides", async () => {
  const f = await fixture();
  const profile = await selectSetupProfile(
    { path: f.path },
    "codex",
    { engine: "codex", model: "gpt-6.1-sol", reasoning: "xhigh" },
    f.provider,
    f.root,
    f.deps.io,
  );
  expect(profile.reasoning).toBe("medium");
  expect(
    (
      await selectSetupProfile(
        { path: f.path, model: "gpt-6.1-sol", reasoning: "high" },
        "codex",
        undefined,
        f.provider,
        f.root,
        f.deps.io,
      )
    ).reasoning,
  ).toBe("high");
});
it("rejects unavailable models and unsupported effort before inference", async () => {
  const f = await fixture();
  await expect(
    terminalSetup(
      {
        deep: true,
        path: f.path,
        engine: "codex",
        model: "missing",
        reasoning: "medium",
      },
      f.deps,
    ),
  ).rejects.toThrow("unavailable");
  await expect(
    terminalSetup(
      {
        deep: true,
        path: f.path,
        engine: "codex",
        model: "gpt-6.1-sol",
        reasoning: "max",
      },
      f.deps,
    ),
  ).rejects.toThrow("does not support");
  expect(f.calls).toHaveLength(0);
  expect(await readdir(f.path)).toEqual(["app.ts"]);
});
it("reports missing authentication and incomplete analysis without fallback or writes", async () => {
  const f = await fixture();
  f.provider.probe = async () => ({
    installed: true,
    compatible: true,
    authenticated: false,
    capabilities: [],
    detail: "not signed in",
  });
  await expect(
    terminalSetup({ deep: true, path: f.path, engine: "codex" }, f.deps),
  ).rejects.toThrow("authentication");
  f.provider.probe = async () => ({
    installed: true,
    compatible: true,
    authenticated: true,
    capabilities: [],
    detail: "signed in",
  });
  f.provider.run = async () => ({
    sessionId: "fixture",
    text: '{"reviewedChunks":[],"notes":[],"questions":[]}',
  });
  await expect(
    terminalSetup(
      {
        deep: true,
        path: f.path,
        engine: "codex",
        model: "gpt-6.1-sol",
        reasoning: "medium",
      },
      f.deps,
    ),
  ).rejects.toThrow("every supplied source chunk");
  expect(await readdir(f.path)).toEqual(["app.ts"]);
});
it("cancellation and guidance-only incompatible flags never apply a proposal", async () => {
  const f = await fixture();
  await expect(
    terminalSetup(
      { path: f.path, guidanceOnly: true, model: "gpt-6.1-sol" },
      f.deps,
    ),
  ).rejects.toThrow("cannot use");
  f.deps.io.ask = async () => {
    f.signal.abort();
    return "yes";
  };
  await expect(
    terminalSetup(
      { path: f.path, engine: "codex", guidanceOnly: true },
      f.deps,
    ),
  ).rejects.toThrow("canceled");
  expect(await readdir(f.path)).toEqual(["app.ts"]);
});
it("host CLI rejects noninteractive setup before invoking Docker and exposes help", async () => {
  const cli = join(process.cwd(), "bin/sddclinic.mjs");
  const result = await command(process.execPath, [cli, "setup"]);
  expect(result.code).toBe(2);
  expect(result.stderr).toContain("interactive terminal");
  const help = await command(process.execPath, [cli, "--help"]);
  expect(help.code).toBe(0);
  expect(help.stdout).toContain("--reasoning");
});

it("keeps the selected effort through consolidation as well as analysis and synthesis", async () => {
  const f = await fixture();
  await writeFile(
    join(f.path, "guide.md"),
    "Observed catalog behavior.\n".repeat(3000),
  );
  f.provider.run = async (_path, r) => {
    f.calls.push(r);
    if (r.prompt.includes("CLINIC_SETUP_COVERAGE")) {
      const input = JSON.parse(r.prompt.split("COVERAGE_INPUT\n").at(-1)!);
      return {
        sessionId: "coverage-fixture",
        text: JSON.stringify({
          reviewedChunks: input.chunks.map((c: { id: string }) => c.id),
          blockingIssues: [],
        }),
      };
    }
    if (r.prompt.includes("CLINIC_SETUP_QUALITY"))
      return {
        sessionId: "quality-fixture",
        text: JSON.stringify(qualityFixture(r.prompt)),
      };
    if (r.prompt.includes("CLINIC_BASELINE_ANALYZE")) {
      const chunks = JSON.parse(r.prompt.split("SOURCE_CHUNKS\n").at(-1)!);
      return {
        sessionId: "fixture",
        text: JSON.stringify({
          reviewedChunks: chunks.map((c: { id: string }) => c.id),
          notes: Array.from({ length: 80 }, () => ({
            text: "Catalog behavior. ".repeat(160),
            sources: [
              {
                path: chunks[0].path,
                startLine: chunks[0].startLine,
                endLine: chunks[0].endLine,
              },
            ],
          })),
          questions: [],
        }),
      };
    }
    if (r.prompt.includes("CLINIC_BASELINE_CONSOLIDATE"))
      return {
        sessionId: "fixture",
        text: JSON.stringify({
          notes: [
            {
              text: "Consolidated behavior.",
              findingIds: JSON.parse(r.prompt.split("FINDINGS\n").at(-1)!).map(
                (n: { id: number }) => n.id,
              ),
            },
          ],
          questions: [],
        }),
      };
    return {
      sessionId: "fixture",
      text: JSON.stringify({
        summary: "Reviewed fixture",
        capabilities: [inferredCapability],
        reused: [],
        questions: [],
      }),
    };
  };
  await terminalSetup(
    {
      deep: true,
      path: f.path,
      engine: "codex",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    },
    f.deps,
  );
  expect(
    f.calls.some((r) => r.prompt.includes("CLINIC_BASELINE_CONSOLIDATE")),
  ).toBe(true);
  expect(
    f.calls.every((r) => r.model === "gpt-6.1-sol" && r.reasoning === "medium"),
  ).toBe(true);
});

it("refuses new agent runs during a GUI mount update and releases the gate afterward", async () => {
  const f = await fixture();
  const { createApp } = await import("../src/server/app.js");
  const app = await createApp({
    dataDir: join(f.root, "app-state"),
    discover: false,
    providers: { codex: f.provider, claude: f.provider },
  });
  try {
    app.store.put("engine", { id: "codex", path: "fixture", connected: true });
    app.store.put("maintenance", {
      id: "gui-mount-update",
      expiresAt: Date.now() + 60_000,
    });
    expect(() => app.runs.testEngine("codex")).toThrow(
      "updating project mounts",
    );
    expect(f.calls).toHaveLength(0);
    app.store.delete("maintenance", "gui-mount-update");
    const run = app.runs.testEngine("codex");
    while (app.runs.active.size)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(app.runs.get(run.id).status).toBe("completed");
  } finally {
    await app.app.close();
  }
});

it("automatically signs in when needed and verifies authentication before analysis", async () => {
  const f = await fixture();
  let authenticated = false;
  let logins = 0;
  f.provider.probe = async () => ({
    installed: true,
    compatible: true,
    authenticated,
    capabilities: [],
    detail: "fixture",
  });
  const deps = {
    ...f.deps,
    io: {
      ...f.deps.io,
      login: async () => {
        logins++;
        authenticated = true;
        return 0;
      },
    },
  };
  await terminalSetup(
    { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
    deps,
  );
  expect(logins).toBe(1);
  expect(f.calls.length).toBeGreaterThan(0);
  expect(f.output()).toContain("Opening your browser");
  await terminalSetup(
    { path: f.path, engine: "codex", guidanceOnly: true },
    deps,
  );
  expect(logins).toBe(1);
  await terminalSetup(
    { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
    deps,
  );
  expect(logins).toBe(1);
});

it("full setup writes source-backed nested catalog specs after review", async () => {
  const f = await fixture();
  const source = "packages/shop/catalog.ts";
  await mkdir(join(f.path, "packages/shop"), { recursive: true });
  await writeFile(
    join(f.path, source),
    "export const activeProducts = products => products.filter(p => p.active);\n",
  );
  await rm(join(f.path, "app.ts"));
  f.provider.run = async (_path, r) => {
    f.calls.push(r);
    if (r.prompt.includes("CLINIC_SETUP_COVERAGE")) {
      const input = JSON.parse(r.prompt.split("COVERAGE_INPUT\n").at(-1)!);
      return {
        sessionId: "coverage-fixture",
        text: JSON.stringify({
          reviewedChunks: input.chunks.map((c: { id: string }) => c.id),
          blockingIssues: [],
        }),
      };
    }
    if (r.prompt.includes("CLINIC_SETUP_QUALITY"))
      return {
        sessionId: "quality-fixture",
        text: JSON.stringify(qualityFixture(r.prompt)),
      };
    const sources = [{ path: source, startLine: 1, endLine: 1 }];
    return {
      sessionId: "catalog",
      text: JSON.stringify(
        r.prompt.includes("CLINIC_BASELINE_ANALYZE")
          ? {
              reviewedChunks: JSON.parse(
                r.prompt.split("SOURCE_CHUNKS\n").at(-1)!,
              ).map((c: { id: string }) => c.id),
              notes: [
                {
                  text: "Only active products appear in the catalog.",
                  sources,
                },
              ],
              questions: [],
            }
          : {
              summary: "Source-backed catalog baseline",
              capabilities: [
                {
                  name: "catalog",
                  purpose:
                    "Allow visitors to browse active products while hiding inactive catalog entries.",
                  requirements: [
                    {
                      name: "Active product listing",
                      statement:
                        "The catalog SHALL return only active products.",
                      basis: "inferred",
                      sources,
                      scenarios: [
                        {
                          name: "List active products",
                          when: "the catalog contains active and inactive products",
                          then: "only active products are returned",
                        },
                      ],
                    },
                  ],
                },
              ],
              reused: [],
              questions: [],
            },
      ),
    };
  };
  let reviewed = false;
  const ask = f.deps.io.ask;
  f.deps.io.ask = async (q) => {
    if (q.startsWith("Apply")) {
      reviewed = true;
      await expect(
        readFile(join(f.path, "openspec/specs/catalog/spec.md")),
      ).rejects.toThrow();
      expect(f.output()).toContain(
        "Specification baseline: 1 new capability specs",
      );
    }
    return ask(q);
  };
  await terminalSetup(
    {
      deep: true,
      path: f.path,
      engine: "codex",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    },
    f.deps,
  );
  expect(reviewed).toBe(true);
  const spec = await readFile(
    join(f.path, "openspec/specs/catalog/spec.md"),
    "utf8",
  );
  for (const text of [
    "## Purpose",
    "### Requirement: Active product listing",
    "SHALL",
    "#### Scenario: List active products",
    "**WHEN**",
    "**THEN**",
    source + ":1-1",
  ])
    expect(spec).toContain(text);
  expect(f.output()).toContain("Analyzing batch 1 of");
});

it("repairs out-of-batch citations using the original evidence and selected model", async () => {
  const f = await fixture();
  await writeFile(
    join(f.path, "app.ts"),
    "export const answer = 42;\n" + "\n".repeat(100000),
  );
  const original = f.provider.run.bind(f.provider);
  let damaged = false;
  f.provider.run = async (path, request) => {
    const result = await original(path, request);
    if (!damaged && request.prompt.includes("CLINIC_BASELINE_ANALYZE")) {
      damaged = true;
      const value = JSON.parse(result.text);
      value.notes = [
        {
          text: "Invalid outside-batch reference",
          sources: [{ path: "app.ts", startLine: 90000, endLine: 90000 }],
        },
      ];
      return { ...result, text: JSON.stringify(value) };
    }
    return result;
  };
  await terminalSetup(
    {
      deep: true,
      path: f.path,
      engine: "codex",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    },
    f.deps,
  );
  expect(
    f.calls.filter((r) => r.prompt.includes("CLINIC_BASELINE_REPAIR")),
  ).toHaveLength(1);
  expect(
    f.calls.every((r) => r.model === "gpt-6.1-sol" && r.reasoning === "medium"),
  ).toBe(true);
  expect(f.output()).toContain("Correcting invalid analysis output");
  expect(
    await readFile(
      join(f.path, "openspec/specs/answer-module/spec.md"),
      "utf8",
    ),
  ).toContain("Published answer");
});

it("fails explicitly when full setup produces no specifications and writes no guidance", async () => {
  const f = await fixture();
  f.provider.run = async (_path, r) => {
    f.calls.push(r);
    if (r.prompt.includes("CLINIC_SETUP_COVERAGE")) {
      const input = JSON.parse(r.prompt.split("COVERAGE_INPUT\n").at(-1)!);
      return {
        sessionId: "coverage-fixture",
        text: JSON.stringify({
          reviewedChunks: input.chunks.map((c: { id: string }) => c.id),
          blockingIssues: [],
        }),
      };
    }
    if (r.prompt.includes("CLINIC_SETUP_QUALITY"))
      return {
        sessionId: "quality-fixture",
        text: JSON.stringify(qualityFixture(r.prompt)),
      };
    return {
      sessionId: "empty",
      text: JSON.stringify(
        r.prompt.includes("CLINIC_BASELINE_ANALYZE")
          ? {
              reviewedChunks: JSON.parse(
                r.prompt.split("SOURCE_CHUNKS\n").at(-1)!,
              ).map((c: { id: string }) => c.id),
              notes: [],
              questions: [],
            }
          : {
              summary: "No supported behavior identified.",
              capabilities: [],
              reused: [],
              questions: ["Provide product requirements."],
            },
      ),
    };
  };
  await expect(
    terminalSetup(
      { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
      f.deps,
    ),
  ).rejects.toThrow("No capability specifications were generated");
  expect(await readdir(f.path)).toEqual(["app.ts"]);
  expect(f.output()).not.toContain("SDD setup applied");
});

it("bounds correction attempts when findings are discarded and never applies scaffolding", async () => {
  const f = await fixture();
  const original = f.provider.run.bind(f.provider);
  f.provider.run = async (path, r) => {
    const result = await original(path, r);
    if (!r.prompt.includes("CLINIC_BASELINE_SYNTHESIZE")) return result;
    return {
      ...result,
      text: JSON.stringify({
        summary: "Discarded findings",
        capabilities: [],
        reused: [],
        questions: [],
      }),
    };
  };
  await expect(
    terminalSetup(
      { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
      f.deps,
    ),
  ).rejects.toThrow("invalid after 2 correction attempts");
  expect(
    f.calls.filter((r) => r.prompt.includes("CLINIC_BASELINE_SYNTHESIZE")),
  ).toHaveLength(3);
  expect(await readdir(f.path)).toEqual(["app.ts"]);
});

it("repairs synthesized citations to inventory lines absent from the supplied findings", async () => {
  const f = await fixture();
  await writeFile(
    join(f.path, "app.ts"),
    "export const answer = 42;\n// unrelated line\n",
  );
  const original = f.provider.run.bind(f.provider);
  let damaged = false;
  f.provider.run = async (path, r) => {
    const result = await original(path, r);
    if (!damaged && r.prompt.includes("CLINIC_BASELINE_SYNTHESIZE")) {
      damaged = true;
      const parsed = JSON.parse(result.text);
      parsed.capabilities[0].requirements[0].sources = [
        { path: "app.ts", startLine: 2, endLine: 2 },
      ];
      return { ...result, text: JSON.stringify(parsed) };
    }
    return result;
  };
  await terminalSetup(
    { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
    f.deps,
  );
  expect(f.output()).toContain("outside its supplied findings");
  expect(
    f.calls.filter((r) => r.prompt.includes("CLINIC_BASELINE_SYNTHESIZE")),
  ).toHaveLength(2);
  expect(
    await readFile(
      join(f.path, "openspec/specs/answer-module/spec.md"),
      "utf8",
    ),
  ).toContain("app.ts:1-1");
});

it("shows elapsed provider waiting progress and clears its heartbeat", async () => {
  const f = await fixture();
  const original = f.provider.run.bind(f.provider);
  let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let first = true;
  f.provider.run = async (path, r) => {
    if (first) {
      first = false;
      entered();
      await waiting;
    }
    return original(path, r);
  };
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  const pending = terminalSetup(
    { deep: true, path: f.path, engine: "codex", model: "gpt-6.1-sol" },
    f.deps,
  );
  try {
    await started;
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.output()).toContain("waiting for gpt-6.1-sol (10s elapsed)");
    release();
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    release();
    await pending.catch(() => {});
    vi.useRealTimers();
  }
});
