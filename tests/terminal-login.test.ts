import { afterEach, expect, it } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { terminalLogin } from "../src/server/terminal-login.js";
const runtimePath = join(process.cwd(), "runtime/browser-auth.mjs");
const hostPath = join(process.cwd(), "bin/setup-browser.mjs");
const { authUrl, relay } = await import(runtimePath);
const { setupBrowser } = await import(hostPath);
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function server() {
  const instance = createServer((_req, res) =>
    res.end("callback reached provider"),
  );
  await new Promise<void>((resolve) =>
    instance.listen(0, "127.0.0.1", resolve),
  );
  cleanups.push(
    () => new Promise<void>((resolve) => instance.close(() => resolve())),
  );
  return (instance.address() as { port: number }).port;
}
async function freePort() {
  const r = await relay({ listenPort: 0, targetPort: 1 });
  const port = r.port;
  await r.close();
  return port;
}
it("validates provider URLs and rejects untrusted redirect targets", () => {
  expect(
    authUrl(
      "https://auth.openai.com/oauth/authorize?redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback",
      "codex",
    ).callbackPort,
  ).toBe(1455);
  for (const url of [
    "https://auth.openai.com.evil.test/",
    "https://user@auth.openai.com/",
    "http://auth.openai.com/",
    "https://auth.openai.com/?redirect_uri=https://evil.test/",
    "https://auth.openai.com/?redirect_uri=http://localhost:22/",
  ])
    expect(authUrl(url, "codex")).toBeNull();
});
it("opens a chunked authenticated URL once and forwards an actual callback", async () => {
  const providerPort = await server();
  const callbackPort = await freePort();
  const url = `https://auth.openai.com/oauth/authorize?redirect_uri=${encodeURIComponent(`http://localhost:${callbackPort}/auth/callback`)}`;
  const opened: string[] = [];
  const bridge = setupBrowser({
    nonce: "test",
    container: "fixture",
    docker: async () => ({ code: 0, output: `127.0.0.1:${providerPort}` }),
    open: async (value: string) => {
      opened.push(value);
      return true;
    },
  });
  cleanups.push(() => bridge.close());
  const message = `SDDCLINIC_AUTH:test:${JSON.stringify({ type: "open", engine: "codex", url })}\n`;
  bridge.push(Buffer.from(message.slice(0, 43)));
  bridge.push(Buffer.from(message.slice(43)));
  await bridge.flush();
  expect(
    await (
      await fetch(`http://127.0.0.1:${callbackPort}/auth/callback`)
    ).text(),
  ).toBe("callback reached provider");
  bridge.push(Buffer.from(message));
  await bridge.flush();
  expect(opened).toEqual([url]);
  bridge.push(Buffer.from('SDDCLINIC_AUTH:test:{"type":"end"}\n'));
  await bridge.flush();
  await expect(fetch(`http://127.0.0.1:${callbackPort}/`)).rejects.toThrow();
});
it("reports browser and callback failures, and ignores another invocation", async () => {
  const occupied = await server();
  const warnings: string[] = [];
  const failures: Error[] = [];
  const bridge = setupBrowser({
    nonce: "expected",
    container: "fixture",
    docker: async () => ({ code: 0, output: `127.0.0.1:${occupied}` }),
    open: async () => false,
    warn: (s: string) => warnings.push(s),
    fail: async (e: Error) => failures.push(e),
  });
  cleanups.push(() => bridge.close());
  bridge.push(
    Buffer.from(
      'SDDCLINIC_AUTH:other:{"type":"open","engine":"codex","url":"https://auth.openai.com/"}\n',
    ),
  );
  await bridge.flush();
  expect(warnings).toEqual([]);
  bridge.push(
    Buffer.from(
      'SDDCLINIC_AUTH:expected:{"type":"open","engine":"codex","url":"https://auth.openai.com/"}\n',
    ),
  );
  await bridge.flush();
  expect(warnings[0]).toContain("manually");
  bridge.push(
    Buffer.from(
      `SDDCLINIC_AUTH:expected:${JSON.stringify({ type: "open", engine: "codex", url: `https://auth.openai.com/?redirect_uri=${encodeURIComponent(`http://localhost:${occupied}/auth/callback`)}` })}\n`,
    ),
  );
  await bridge.flush();
  expect(failures[0].message).toContain("unavailable");
});
it("uses standard login, relays its URL and cancels the subprocess and listener", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinic-login-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const script = join(root, "provider");
  const providerPort = await server();
  const relayPort = await freePort();
  const url = `https://auth.openai.com/oauth/authorize?redirect_uri=${encodeURIComponent(`http://localhost:${providerPort}/auth/callback`)}`;
  await writeFile(
    script,
    `#!${process.execPath}\nif(process.argv.slice(2).join(' ')!=='login')process.exit(2);process.stdout.write(${JSON.stringify(url.slice(0, 25))});setTimeout(()=>console.log(${JSON.stringify(url.slice(25))}),10);setInterval(()=>{},1000);`,
    { mode: 0o755 },
  );
  const abort = new AbortController();
  let output = "";
  const login = terminalLogin("codex", abort.signal, {
    executable: script,
    nonce: "fixture",
    relayPort,
    write: (s) => {
      output += s;
    },
  });
  const outcome = login.catch((error: Error) => error);
  try {
    await expect
      .poll(() => output.includes('"type":"open"'), { timeout: 4000 })
      .toBe(true);
    expect(
      await (await fetch(`http://127.0.0.1:${relayPort}/`)).text(),
    ).toContain("reached provider");
  } finally {
    abort.abort();
    expect(await outcome).toBeInstanceOf(Error);
  }
  expect(output).toContain('"type":"end"');
  await expect(fetch(`http://127.0.0.1:${relayPort}/`)).rejects.toThrow();
});

it("completes normal Claude login and emits browser/end events without a callback", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinic-claude-login-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const script = join(root, "provider");
  await writeFile(
    script,
    `#!${process.execPath}\nif(process.argv.slice(2).join(' ')!=='auth login')process.exit(2);console.log('https://claude.ai/oauth/authorize');setTimeout(()=>process.exit(0),50);`,
    { mode: 0o755 },
  );
  let output = "";
  expect(
    await terminalLogin("claude", new AbortController().signal, {
      executable: script,
      nonce: "fixture",
      write: (s) => {
        output += s;
      },
    }),
  ).toBe(0);
  expect(output).toContain('"type":"open","engine":"claude"');
  expect(output).toContain('"type":"end"');
});
