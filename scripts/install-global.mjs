#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  chmod,
  rename,
  rm,
} from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { values } = parseArgs({
  options: { prefix: { type: "string" }, "no-path": { type: "boolean" } },
});
const prefix = resolve(values.prefix ?? join(homedir(), ".local"));
const work = await mkdtemp(join(tmpdir(), "sddclinic-install-"));
const env = {
  ...process.env,
  PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
};
const shellQuote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}).`);
}
try {
  run("pnpm", ["pack", "--pack-destination", work]);
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const archive = join(work, `${pkg.name}-${pkg.version}.tgz`);
  const digest = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex")
    .slice(0, 12);
  const destination = join(
    prefix,
    "share",
    "sddclinic",
    `${pkg.version}-${digest}`,
  );
  await mkdir(dirname(destination), { recursive: true });
  run("tar", ["-xzf", archive, "-C", work]);
  try {
    await rename(join(work, "package"), destination);
  } catch (e) {
    if (!["EEXIST", "ENOTEMPTY"].includes(e.code)) throw e;
  }
  await mkdir(join(prefix, "bin"), { recursive: true });
  for (const name of ["sddclinic", "sdd-clinic"]) {
    const target = join(prefix, "bin", name);
    // Refuse to replace an unrelated installed command.
    const old = await readFile(target, "utf8").catch((e) => {
      if (e.code !== "ENOENT") throw e;
      return null;
    });
    if (old !== null && !old.includes("# SDD Clinic local package launcher"))
      throw new Error(
        `Preserving existing ${target}; choose a different --prefix.`,
      );
    const pending = target + ".tmp-" + process.pid;
    await writeFile(
      pending,
      `#!/bin/sh\n# SDD Clinic local package launcher\nexec ${shellQuote(process.execPath)} ${shellQuote(join(destination, "bin/sddclinic.mjs"))} "$@"\n`,
      { mode: 0o755 },
    );
    await chmod(pending, 0o755);
    await rename(pending, target);
  }
  if (!values["no-path"]) {
    const shell = process.env.SHELL ?? "";
    const rc = join(homedir(), shell.endsWith("zsh") ? ".zshrc" : ".bashrc");
    const marker = "# SDD Clinic global command path";
    const old = await readFile(rc, "utf8").catch((e) => {
      if (e.code !== "ENOENT") throw e;
      return "";
    });
    if (!old.includes(marker))
      await writeFile(
        rc,
        old +
          `\n${marker}\nexport PATH=${shellQuote(join(prefix, "bin"))}:"$PATH"\n`,
      );
    console.log(
      `Added command path to ${rc}. Open a new terminal, or run: export PATH=${shellQuote(join(prefix, "bin"))}:"$PATH"`,
    );
  }
  const { attachExistingGui } = await import("../bin/global-gui.mjs");
  await attachExistingGui(root).catch((e) =>
    console.log(`GUI attachment deferred: ${e.message}`),
  );
  console.log(
    `Installed sddclinic and sdd-clinic from ${archive} into ${destination}.\nRun ${join(prefix, "bin", "sddclinic")} --help`,
  );
} finally {
  await rm(work, { recursive: true, force: true });
}
