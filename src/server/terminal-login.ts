import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import type { EngineKind } from "../shared/types.js";

// This dependency also runs in the built-ins-only host launcher.
const bridgePath = new URL("../../runtime/browser-auth.mjs", import.meta.url)
  .href;
export async function terminalLogin(
  engine: EngineKind,
  signal: AbortSignal,
  options: {
    executable?: string;
    write?: (text: string) => void;
    nonce?: string;
    relayPort?: number;
  } = {},
): Promise<number> {
  const { authUrl, lines, relay } = await import(bridgePath);
  const write =
    options.write ??
    ((text: string) => {
      process.stdout.write(text);
    });
  const nonce = options.nonce ?? process.env.CLINIC_SETUP_INVOCATION;
  let forwarding: { close(): Promise<void> } | undefined;
  let chain = Promise.resolve();
  let failure: Error | undefined;
  const seen = new Set<string>();
  const emit = (event: object) =>
    write(`\nSDDCLINIC_AUTH:${nonce}:${JSON.stringify(event)}\n`);
  signal.throwIfAborted();
  const child = spawn(
    options.executable ?? engine,
    engine === "codex" ? ["login"] : ["auth", "login"],
    {
      stdio: ["inherit", "pipe", "pipe"],
      signal,
      env: { ...process.env, BROWSER: "true" },
    },
  );
  const reader = () =>
    lines((line: string) => {
      for (const candidate of stripVTControlCharacters(line).match(
        /https:\/\/[^\s<>"']+/g,
      ) ?? []) {
        const auth = authUrl(candidate, engine);
        if (!auth || seen.has(auth.url)) continue;
        seen.add(auth.url);
        chain = chain
          .then(async () => {
            signal.throwIfAborted();
            if (auth.callbackPort) {
              await forwarding?.close();
              forwarding = await relay({
                listenHost: "0.0.0.0",
                listenPort: options.relayPort ?? 1456,
                targetPort: auth.callbackPort,
              });
            }
            emit({ type: "open", engine, ...auth });
          })
          .catch((error: Error) => {
            failure = error;
            child.kill("SIGTERM");
          });
      }
    });
  const readers = [reader(), reader()];
  for (const [index, stream] of [child.stdout, child.stderr].entries()) {
    stream!.on("data", (chunk: Buffer) => {
      write(chunk.toString());
      readers[index].push(chunk);
    });
  }
  const abort = () => {
    child.kill("SIGTERM");
  };
  signal.addEventListener("abort", abort, { once: true });
  let timer: NodeJS.Timeout | undefined;
  try {
    const code = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
      timer = setTimeout(
        () => {
          failure = new Error(
            "Provider sign-in timed out. Rerun setup to try again.",
          );
          child.kill("SIGTERM");
        },
        15 * 60 * 1000,
      );
    });
    for (const reader of readers) reader.end();
    await chain;
    signal.throwIfAborted();
    if (failure) throw failure;
    return code;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    child.kill("SIGTERM");
    await chain;
    await forwarding?.close();
    emit({ type: "end" });
  }
}
