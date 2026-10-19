#!/usr/bin/env node
// The host launcher uses only Node built-ins. Application code runs in Docker.
import { parseArgs } from "node:util";
import { realpath, stat, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const help = `SDD Clinic

  sddclinic setup [path] [--engine codex|claude] [--model MODEL]
                  [--reasoning low|medium|high|xhigh|max] [--repair | --guidance-only | --deep | --rebuild]
  sddclinic start [--port 4310] [--data-dir PATH] [--no-open]
  sddclinic doctor

Setup defaults to the current directory. Requires Docker Compose and an interactive
terminal. Reviews the complete diff before writing. Model reasoning defaults to medium.
Default setup generates initial specs from bounded project context. Use --deep for a full source audit; --rebuild also creates a reconstruction blueprint.
Successful setup registers the project in the global GUI. Provider sign-in for terminal analysis is separate.
The sdd-clinic alias supports the same commands.
`;
function run(args, env, capture = false, observe) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      env,
      stdio: capture
        ? ["ignore", "pipe", "pipe"]
        : observe
          ? ["inherit", "pipe", "pipe"]
          : "inherit",
    });
    let output = "";
    let errors = "";
    if (capture) {
      child.stdout.on("data", (b) => (output += b));
      child.stderr.on("data", (b) => (errors += b));
    }
    if (observe) {
      child.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        observe(chunk);
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
      });
    }
    child.on("error", () =>
      reject(
        new Error(
          "Docker is unavailable. Install Docker with Compose and start it.",
        ),
      ),
    );
    child.on("exit", (code, signal) =>
      resolve({
        code: signal === "SIGINT" ? 130 : (code ?? 1),
        output,
        errors,
      }),
    );
  });
}
async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        help: { type: "boolean", short: "h" },
        engine: { type: "string" },
        model: { type: "string" },
        reasoning: { type: "string" },
        "guidance-only": { type: "boolean" },
        deep: { type: "boolean" },
        rebuild: { type: "boolean" },
        repair: { type: "boolean" },
        port: { type: "string" },
        "data-dir": { type: "string" },
        "no-open": { type: "boolean" },
      },
    });
  } catch (e) {
    throw new Error(e.message + "\nRun sddclinic --help.");
  }
  const { values: v, positionals: p } = parsed;
  if (v.help) {
    console.log(help);
    return;
  }
  const action = p[0] ?? "start";
  if (!["setup", "start", "doctor"].includes(action))
    throw new Error(`Unknown command: ${action}. Run sddclinic --help.`);
  if (p.length > (action === "setup" ? 2 : 1))
    throw new Error("Unexpected arguments. Run sddclinic --help.");
  if (v.engine && !["codex", "claude"].includes(v.engine))
    throw new Error("Choose --engine codex or claude.");
  if (
    v.reasoning &&
    !["low", "medium", "high", "xhigh", "max"].includes(v.reasoning)
  )
    throw new Error("Choose --reasoning low, medium, high, xhigh or max.");
  if (
    v.repair &&
    (v["guidance-only"] || v.model || v.reasoning || v.deep || v.rebuild)
  )
    throw new Error("--repair cannot be combined with analysis/model options.");
  if (v["guidance-only"] && (v.model || v.reasoning || v.deep || v.rebuild))
    throw new Error(
      "--guidance-only cannot be combined with --model, --reasoning or --deep/--rebuild.",
    );
  if (
    action !== "setup" &&
    (v.engine ||
      v.model ||
      v.reasoning ||
      v["guidance-only"] ||
      v.deep ||
      v.rebuild ||
      v.repair)
  )
    throw new Error("Model, engine and guidance options require setup.");
  if (action !== "start" && (v.port || v["no-open"] || v["data-dir"]))
    throw new Error("Port and browser options apply to start, not setup.");
  if (action === "setup" && (!process.stdin.isTTY || !process.stdout.isTTY))
    throw new Error(
      "Setup requires an interactive terminal to select a model and review changes. Run it directly in your terminal.",
    );
  const target = await realpath(resolve(p[1] ?? process.cwd()));
  if (!(await stat(target)).isDirectory())
    throw new Error("Choose an existing project directory.");
  if (v.port && (!/^\d+$/.test(v.port) || +v.port < 1 || +v.port > 65535))
    throw new Error("Choose a port from 1 to 65535.");
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const env = {
    ...process.env,
    CLINIC_CLI_PROJECT: target,
    CLINIC_PROJECT_NAME: basename(target),
    CLINIC_SETUP_INVOCATION: randomUUID(),
    BUILDKIT_PROGRESS: "plain",
    CLINIC_CLI_PROJECT_KEY: createHash("sha256")
      .update(target)
      .digest("hex")
      .slice(0, 24),
    CLINIC_CLI_VERSION: pkg.version,
    CLINIC_CLI_IMAGE:
      pkg.sddClinicRuntimeImage || `sddclinic-terminal:${pkg.version}`,
    CLINIC_CLI_PORT: v.port ?? "4310",
    CLINIC_CLI_UID: String(process.getuid?.() ?? 1000),
    CLINIC_CLI_GID: String(process.getgid?.() ?? 1000),
  };
  const base = [
    "compose",
    "--project-name",
    "sddclinic-terminal",
    "--project-directory",
    root,
    "-f",
    join(root, "runtime/compose.yaml"),
  ];
  const ready = await run(
    ["info", "--format", "{{.ServerVersion}}"],
    env,
    true,
  );
  if (ready.code)
    throw new Error(
      "Docker is not ready. Start Docker Desktop or your Docker daemon and retry.",
    );
  const compose = await run(["compose", "version"], env, true);
  if (compose.code)
    throw new Error(
      "Docker Compose is required. Install the Compose plugin and retry.",
    );
  const usePublishedImage =
    !!pkg.sddClinicRuntimeImage && process.env.SDDCLINIC_BUILD !== "1";
  console.log(
    usePublishedImage
      ? `Preparing SDD Clinic runtime (${env.CLINIC_CLI_IMAGE}).`
      : "Preparing SDD Clinic runtime (Docker build cache is reused).",
  );
  const prepared = await run(
    [...base, usePublishedImage ? "pull" : "build", "clinic"],
    env,
  );
  if (prepared.code) {
    if (usePublishedImage)
      throw new Error(
        `Cannot pull ${env.CLINIC_CLI_IMAGE}. Check network and registry access, or explicitly build the bundled runtime with SDDCLINIC_BUILD=1 sddclinic ${action}.`,
      );
    process.exitCode = prepared.code;
    return;
  }
  const { syncGlobalGui } = await import("./global-gui.mjs");
  const openGui = (url) => {
    console.log(`Global Clinic GUI: ${url}`);
    if (!v["no-open"]) {
      const browser = spawn(
        process.platform === "darwin" ? "open" : "xdg-open",
        [url],
        { stdio: "ignore" },
      );
      browser.on("error", () => {});
      browser.unref();
    }
  };
  if (action === "start") {
    const gui = await syncGlobalGui(root, undefined, {
      image: env.CLINIC_CLI_IMAGE,
      port: v.port,
      dataDir: v["data-dir"] ? resolve(v["data-dir"]) : undefined,
    });
    openGui(gui.url);
    return;
  }
  console.log(
    "Terminal analysis uses separate provider sign-in. Successful setup is registered in the global GUI.",
  );
  const args = [...base, "run", "--rm"];
  const container = `sddclinic-setup-${env.CLINIC_SETUP_INVOCATION}`;
  if (action !== "setup") args.push("-T");
  else {
    args.push("--name", container, "-t");
    if (!v["guidance-only"] && !v.repair)
      args.push("--publish", "127.0.0.1::1456");
  }
  args.push("clinic", "node", "dist/server/cli.js", action);
  if (action === "setup") {
    args.push("/projects");
    for (const key of ["engine", "model", "reasoning"])
      if (v[key]) args.push(`--${key}`, v[key]);
    if (v["guidance-only"]) args.push("--guidance-only");
    if (v.deep) args.push("--deep");
    if (v.rebuild) args.push("--rebuild");
    if (v.repair) args.push("--repair");
  }
  let bridge;
  let loginError;
  if (action === "setup" && !v["guidance-only"] && !v.repair) {
    const { setupBrowser } = await import("./setup-browser.mjs");
    bridge = setupBrowser({
      nonce: env.CLINIC_SETUP_INVOCATION,
      container,
      docker: (args) => run(args, env, true),
      fail: async (error) => {
        loginError = error;
        await run(["kill", "--signal", "SIGINT", container], env, true);
      },
    });
  }
  const interrupt = () => {
    void run(["kill", "--signal", "SIGINT", container], env, true).catch(
      () => {},
    );
  };
  if (action === "setup") process.on("SIGINT", interrupt);
  let result;
  try {
    result = await run(args, env, false, bridge?.push);
  } finally {
    process.off("SIGINT", interrupt);
    await bridge?.close();
  }
  if (loginError) throw loginError;
  process.exitCode = result.code;
  if (action === "setup" && result.code === 0) {
    const receiptCode = `const fs=require('node:fs');const p=process.env.CLINIC_DATA_DIR+'/receipt-'+process.env.CLINIC_SETUP_INVOCATION+'.json';process.stdout.write(fs.readFileSync(p,'utf8'));fs.unlinkSync(p);`;
    const receipt = await run(
      [...base, "run", "--rm", "-T", "clinic", "node", "-e", receiptCode],
      env,
      true,
    );
    if (receipt.code)
      throw new Error(
        "Setup ended but completion could not be verified. GUI registration was not claimed; rerun setup.",
      );
    if (["applied", "unchanged"].includes(JSON.parse(receipt.output).status)) {
      try {
        const gui = await syncGlobalGui(root, target, {
          image: env.CLINIC_CLI_IMAGE,
        });
        console.log(`Project registered in global Clinic GUI. Open ${gui.url}`);
      } catch (e) {
        console.error(`Setup is saved. GUI registration pending: ${e.message}`);
        process.exitCode = 1;
      }
    }
  }
}
main().catch((e) => {
  console.error(`SDD Clinic: ${e.message}`);
  process.exitCode = 2;
});
