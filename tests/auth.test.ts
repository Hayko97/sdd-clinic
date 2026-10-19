import { afterEach, expect, it } from "vitest";
import { copyFile, chmod, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createApp } from "../src/server/app.js";
import { EngineAuth } from "../src/server/engine-auth.js";
import { Store } from "../src/server/store.js";
import { SecretVault } from "../src/server/data.js";
import { CodexAdapter } from "../src/server/engines.js";
import { tempDir, fixtureEngine } from "./helpers.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup(mode = "success") {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const original = await fixtureEngine(root),
    path = join(root, "auth-engine.cjs");
  await copyFile(original, path);
  await chmod(path, 0o755);
  await writeFile(join(root, "fixture-auth-mode"), mode);
  const c = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
  });
  cleanup.push(() => c.app.close());
  const session = await c.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: c.bootstrapToken },
  });
  const headers = { cookie: `clinic_session=${session.cookies[0]!.value}` };
  return { ...c, root, path, headers };
}
async function until(fn: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error("Condition did not complete");
}
it("authenticates through provider device login, confirms connection and never persists the code", async () => {
  const c = await setup();
  const before = await c.engineAuth.connect("codex", c.path);
  expect(before.connected).toBe(false);
  expect(
    (
      await c.app.inject({
        method: "POST",
        url: "/api/engines/codex/login",
        payload: { path: c.path },
      })
    ).statusCode,
  ).toBe(401);
  const started = await c.app.inject({
    method: "POST",
    url: "/api/engines/codex/login",
    headers: c.headers,
    payload: { path: c.path },
  });
  expect(started.statusCode).toBe(200);
  await until(() => c.engineAuth.status("codex").status === "waiting");
  expect(c.engineAuth.status("codex").userCode).toBe("TEST-1234");
  expect(JSON.stringify(c.store.list("engine"))).not.toContain("TEST-1234");
  await until(() => c.engineAuth.status("codex").status === "connected");
  expect(c.store.require<any>("engine", "codex").connected).toBe(true);
  expect(c.engineAuth.status("codex").userCode).toBeUndefined();
  expect(c.store.list("run")).toHaveLength(0);
});
it("rejects duplicate attempts/path changes, cancels login and handles provider rejection", async () => {
  const c = await setup("hang");
  c.engineAuth.start("codex", c.path);
  await until(() => c.engineAuth.status("codex").status === "waiting");
  expect(() => c.engineAuth.start("codex", c.path)).toThrow("already active");
  await expect(
    c.engineAuth.connect("codex", "other-executable"),
  ).rejects.toThrow("already active");
  expect(c.engineAuth.cancel("codex").status).toBe("canceled");
  expect(c.engineAuth.status("codex").userCode).toBeUndefined();
  await writeFile(join(c.root, "fixture-auth-mode"), "failed");
  c.engineAuth.start("codex", c.path);
  await until(() => c.engineAuth.status("codex").status === "failed");
  expect(c.engineAuth.status("codex").error).toContain("denied");
  expect(c.store.require<any>("engine", "codex").connected).toBe(false);
  await writeFile(join(c.root, "fixture-auth-mode"), "error");
  c.engineAuth.start("codex", c.path);
  await until(() => c.engineAuth.status("codex").status === "failed");
  expect(c.engineAuth.status("codex").error).toContain("workspace policy");
});
it("expires an unfinished challenge, clears it on restart, and does not call unknown auth connected", async () => {
  const store = new Store(":memory:");
  const provider = {
    probe: async () => ({
      installed: true,
      compatible: true,
      authenticated: null,
      detail: "Unknown",
      capabilities: [],
    }),
    run: async () => ({ text: "", sessionId: "fixture" }),
    login: async (_: string, r: any) => {
      r.onChallenge({
        userCode: "TRANSIENT",
        verificationUrl: "https://auth.openai.com/codex/device",
      });
      await new Promise<void>((resolve) =>
        r.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
    },
  };
  const auth = new EngineAuth(store, { codex: provider, claude: provider }, 40);
  try {
    expect((await auth.connect("codex", "fixture")).connected).toBe(false);
    auth.start("codex", "fixture");
    await until(() => auth.status("codex").status === "expired");
    expect(auth.status("codex").userCode).toBeUndefined();
    await auth.close();
    expect(auth.status("codex").status).toBe("idle");
    expect(
      new EngineAuth(store, { codex: provider, claude: provider }).status(
        "codex",
      ).status,
    ).toBe("idle");
  } finally {
    await auth.close();
    store.close();
  }
});
it("gives container-specific authentication guidance", async () => {
  const c = await setup();
  const prior = process.env.CLINIC_CONTAINER;
  process.env.CLINIC_CONTAINER = "1";
  try {
    expect((await new CodexAdapter().probe(c.path)).detail).toContain(
      "docker compose exec clinic codex login --device-auth",
    );
  } finally {
    if (prior === undefined) delete process.env.CLINIC_CONTAINER;
    else process.env.CLINIC_CONTAINER = prior;
  }
});
