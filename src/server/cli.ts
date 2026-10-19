#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { createApp } from "./app.js";
import { adapters, discoverEngines } from "./engines.js";
import { errorText, command } from "./util.js";

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", default: "4310" },
      "data-dir": { type: "string" },
      dev: { type: "boolean" },
      "no-open": { type: "boolean" },
      help: { type: "boolean" },
      engine: { type: "string" },
      model: { type: "string" },
      reasoning: { type: "string" },
      "guidance-only": { type: "boolean" },
      deep: { type: "boolean" },
      rebuild: { type: "boolean" },
    },
  });
  const action = positionals[0] ?? "start";
  if (values.help) {
    process.stdout.write(
      "SDD Clinic\n\n  sddclinic setup [path] [--engine codex|claude] [--model MODEL] [--reasoning medium] [--guidance-only | --deep | --rebuild]\n  sdd-clinic start [--port 4310] [--data-dir PATH] [--no-open]\n  sdd-clinic doctor\n\nRequires Node.js 24+, Git, and an installed Codex or Claude CLI.\n",
    );
    return;
  }
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("SDD Clinic requires Node.js 24 or newer.");
  if (action === "setup") {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error("Setup requires an interactive terminal.");
    const { terminalSetup } = await import("./terminal-setup.js");
    const { createInterface } = await import("node:readline/promises");
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    try {
      const setupResult = await terminalSetup(
        {
          path: resolve(positionals[1] ?? process.cwd()),
          name: process.env.CLINIC_PROJECT_NAME || undefined,
          engine: values.engine as "codex" | "claude" | undefined,
          model: values.model,
          reasoning: values.reasoning,
          guidanceOnly: values["guidance-only"],
          deep: values.deep,
          rebuild: values.rebuild,
        },
        {
          dataDir: resolve(
            process.env.CLINIC_DATA_DIR ??
              join(homedir(), ".sdd-clinic", "terminal"),
          ),
          signal: controller.signal,
          io: {
            write: (text) => {
              process.stdout.write(text);
            },
            ask: async (question) => {
              const rl = createInterface({
                input: process.stdin,
                output: process.stdout,
              });
              rl.on("SIGINT", interrupt);
              try {
                return await rl.question(question, {
                  signal: controller.signal,
                });
              } finally {
                rl.close();
              }
            },
            login: async (engine) => {
              const { terminalLogin } = await import("./terminal-login.js");
              return terminalLogin(engine, controller.signal);
            },
          },
        },
      );
      const invocation = process.env.CLINIC_SETUP_INVOCATION;
      if (invocation && /^[a-f0-9-]{36}$/.test(invocation)) {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(
          join(process.env.CLINIC_DATA_DIR!, `receipt-${invocation}.json`),
          JSON.stringify({ status: setupResult }),
          { mode: 0o600 },
        );
      }
    } catch (error) {
      if (controller.signal.aborted) {
        process.stderr.write("Setup canceled.\n");
        process.exitCode = 130;
      } else throw error;
    } finally {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    }
    return;
  }
  if (action === "doctor") {
    const providers = await Promise.all(
      (await discoverEngines()).map(async (e) => ({
        engine: e.id,
        path: e.path,
        ...(await adapters[e.id].probe(e.path)),
        ...(process.env.CLINIC_TERMINAL === "1"
          ? {
              setupHint:
                "Run sddclinic setup to select a model and sign in within this terminal runtime.",
            }
          : {}),
      })),
    );
    let git = "unavailable";
    try {
      git = (await command("git", ["--version"])).stdout.trim();
    } catch {}
    process.stdout.write(
      JSON.stringify(
        {
          node: process.version,
          git,
          providers,
          notes: [
            "Doctor does not make model inference requests.",
            "Run start and use the CLI connection screen to authenticate and test.",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  if (action !== "start") throw new Error(`Unknown command: ${action}`);
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("Choose a port between 0 and 65535.");
  const clinic = await createApp({
    dataDir: resolve(
      values["data-dir"] ??
        process.env.CLINIC_DATA_DIR ??
        join(homedir(), ".sdd-clinic"),
    ),
    dev: values.dev,
  });
  try {
    const address = await clinic.app.listen({
      port,
      host: process.env.CLINIC_CONTAINER === "1" ? "0.0.0.0" : "127.0.0.1",
    });
    clinic.runs.baseUrl = address.replace("0.0.0.0", "127.0.0.1");
    const url = `${address.replace("0.0.0.0", "127.0.0.1")}/#token=${clinic.bootstrapToken}`;
    process.stdout.write(
      `\n  SDD Clinic is ready\n  ${url}\n\n  Keep this process running for agent runs and PO schedules.\n`,
    );
    if (!values["no-open"]) {
      const executable =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "explorer"
            : "xdg-open";
      const browser = spawn(executable, [url], { stdio: "ignore" });
      browser.on("error", () => {});
      browser.unref();
    }
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await clinic.app.close();
    };
    process.on("SIGINT", () => void close());
    process.on("SIGTERM", () => void close());
  } catch (e) {
    await clinic.app.close();
    throw e;
  }
}
main().catch((e) => {
  process.stderr.write(`SDD Clinic: ${errorText(e)}\n`);
  process.exitCode = 1;
});
