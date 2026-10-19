import { it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adapters, discoverEngines } from "../src/server/engines.js";

for (const kind of ["codex", "claude"] as const) {
  it.skipIf(process.env.CLINIC_LIVE_ENGINE !== kind)(
    `opt-in live ${kind} conversation`,
    async () => {
      const cwd = await mkdtemp(join(tmpdir(), "clinic-live-"));
      try {
        const path =
          process.env.CLINIC_ENGINE_PATH ||
          (await discoverEngines()).find((e) => e.id === kind)!.path;
        const probe = await adapters[kind].probe(path);
        expect(probe.compatible).toBe(true);
        const result = await adapters[kind].run(path, {
          cwd,
          prompt: "Reply with exactly CLINIC_OK. Do not use tools.",
          mode: "read-only",
          tools: [],
          timeoutMs: 60000,
          maxTurns: 2,
          signal: new AbortController().signal,
          onEvent: () => {},
          onApproval: async () => ({ approved: false }),
        });
        expect(result.text).toContain("CLINIC_OK");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    },
    70000,
  );
}
