import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { command } from "../src/server/util.js";
const roots: string[] = [];
afterEach(async () => {
  for (const r of roots.splice(0))
    await rm(r, { recursive: true, force: true });
});
it("installs the pinned provider once and forwards arguments, preserving failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinic-provider-install-"));
  roots.push(root);
  const bin = join(root, "bin");
  await mkdir(bin);
  const log = join(root, "installs.jsonl");
  // macOS lacks flock; this unit fixture exercises installation/forwarding, Docker covers the real lock tool.
  await writeFile(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await writeFile(
    join(bin, "npm"),
    `#!${process.execPath}\nconst fs=require('node:fs'),path=require('node:path');const a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(a)+'\\n');if(process.env.FAIL_INSTALL)process.exit(19);const prefix=a[a.indexOf('--prefix')+1];fs.mkdirSync(path.join(prefix,'node_modules/.bin'),{recursive:true});fs.writeFileSync(path.join(prefix,'node_modules/.bin/claude'),'#!/bin/sh\\nprintf "%s\\\\n" "$@"\\n',{mode:0o755});\n`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    HOME: root,
    PATH: `${bin}:${process.env.PATH}`,
  };
  const script = join(process.cwd(), "runtime/claude.sh");
  const first = await command("sh", [script, "--version"], { env });
  expect(first.code).toBe(0);
  expect(first.stdout.trim()).toBe("--version");
  const second = await command("sh", [script, "auth", "login"], { env });
  expect(second.code).toBe(0);
  expect(second.stdout).toBe("auth\nlogin\n");
  const installs = (await readFile(log, "utf8")).trim().split("\n");
  expect(installs).toHaveLength(1);
  expect(installs[0]).toContain("@anthropic-ai/claude-code@2.1.302");
  await rm(join(root, ".sdd-clinic"), { recursive: true });
  const failed = await command("sh", [script, "--version"], {
    env: { ...env, FAIL_INSTALL: "1" },
  });
  expect(failed.code).toBe(19);
});

it("allows cold public-image provider preparation to exceed the normal eight-second probe timeout", async () => {
  const { ClaudeAdapter } = await import("../src/server/engines.js");
  const root = await mkdtemp(join(tmpdir(), "clinic-cold-provider-"));
  roots.push(root);
  const executable = join(root, "claude");
  await writeFile(
    executable,
    `#!${process.execPath}\nconst a=process.argv.slice(2);if(a[0]==='--version')setTimeout(()=>console.log('2.1.302'),8500);else if(a[0]==='--help')console.log('--output-format stream-json');else console.log(JSON.stringify({loggedIn:false}));\n`,
    { mode: 0o755 },
  );
  const old = process.env.CLINIC_LAZY_CLAUDE;
  process.env.CLINIC_LAZY_CLAUDE = "1";
  try {
    const result = await new ClaudeAdapter().probe(executable);
    expect(result.compatible).toBe(true);
    expect(result.authenticated).toBe(false);
  } finally {
    if (old === undefined) delete process.env.CLINIC_LAZY_CLAUDE;
    else process.env.CLINIC_LAZY_CLAUDE = old;
  }
}, 20000);
