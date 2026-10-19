import { describe, it, expect, afterEach } from "vitest";
import { rm, writeFile } from "node:fs/promises";
import { CodexAdapter, ClaudeAdapter } from "../src/server/engines.js";
import type { EngineRequest } from "../src/shared/types.js";
import { fixtureEngine, tempDir } from "./helpers.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function setup() {
  const root = await tempDir();
  roots.push(root);
  const executable = await fixtureEngine(root);
  const events: { type: string; data: unknown }[] = [];
  const controller = new AbortController();
  const request: EngineRequest = {
    tools: ["read", "command"],
    cwd: root,
    prompt: "Connection test",
    mode: "read-only",
    timeoutMs: 5000,
    maxTurns: 5,
    signal: controller.signal,
    onEvent: (type, data) => events.push({ type, data }),
    onApproval: async () => ({ approved: true }),
  };
  return { root, executable, events, controller, request };
}
describe("provider protocol contracts", () => {
  for (const [name, Adapter] of [
    ["Codex", CodexAdapter],
    ["Claude", ClaudeAdapter],
  ] as const) {
    it(`${name} probes and completes a structured streamed conversation`, async () => {
      const { executable, request, events } = await setup();
      const adapter = new Adapter();
      expect((await adapter.probe(executable)).compatible).toBe(true);
      const result = await adapter.run(executable, request);
      expect(result.text).toContain("connection ready");
      expect(result.sessionId).toContain("fixture-session");
      expect(events.some((e) => e.type === "message")).toBe(true);
      const resumed = await adapter.run(executable, {
        ...request,
        sessionId: result.sessionId,
      });
      expect(resumed.sessionId).toBe(result.sessionId);
    });
    it(`${name} reports malformed output and can interrupt a hanging process`, async () => {
      const { executable, request, controller } = await setup();
      const adapter = new Adapter();
      await expect(
        adapter.run(executable, { ...request, prompt: "MALFORMED" }),
      ).rejects.toThrow(/JSON/);
      const running = adapter.run(executable, { ...request, prompt: "HANG" });
      setTimeout(() => controller.abort(), 150);
      await expect(running).rejects.toThrow("interrupted");
    });
  }
  it("bridges Codex approval requests instead of silently accepting them", async () => {
    const { executable, request } = await setup();
    let count = 0;
    await new CodexAdapter().run(executable, {
      ...request,
      prompt: "ASK_APPROVAL",
      onApproval: async (title) => {
        expect(title).toBe("fixture check");
        count++;
        return { approved: false };
      },
    });
    expect(count).toBe(1);
  });
  it("returns actionable diagnostics for missing executables", async () => {
    const result = await new CodexAdapter().probe("/missing/clinic-provider");
    expect(result.installed).toBe(false);
    expect(result.detail).toContain("Install Codex");
  });
});

for (const Adapter of [CodexAdapter, ClaudeAdapter])
  it(`${Adapter.name} sends native image content`, async () => {
    const { root, executable, request } = await setup();
    const path = root + "/reference.png";
    await writeFile(
      path,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6n8AAAAASUVORK5CYII=",
        "base64",
      ),
    );
    const result = await new Adapter().run(executable, {
      ...request,
      prompt: "IMAGE_PROTOCOL",
      images: [{ path, mime: "image/png" }],
    });
    expect(result.text).toContain("Image content received");
  });

for (const Adapter of [CodexAdapter, ClaudeAdapter])
  it(`${Adapter.name} forwards explicit model and medium effort through its provider protocol`, async () => {
    const { executable, request, root } = await setup();
    const adapter = new Adapter();
    const catalog = await adapter.setupModels(executable, root);
    if (catalog) expect(catalog[0].efforts).toContain("medium");
    const result = await adapter.run(executable, {
      ...request,
      prompt: "EFFORT_PROTOCOL",
      model: "gpt-6.1-sol",
      reasoning: "medium",
    });
    expect(JSON.parse(result.text)).toEqual({
      model: "gpt-6.1-sol",
      effort: "medium",
    });
  });
