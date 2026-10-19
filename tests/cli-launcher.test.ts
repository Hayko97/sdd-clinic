import { it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { command } from "../src/server/util.js";
const roots: string[] = [];
afterEach(async () => {
  for (const p of roots.splice(0))
    await rm(p, { recursive: true, force: true });
});
it("starts the managed GUI from another cwd with requested port and data directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinic launcher "));
  roots.push(root);
  const bin = join(root, "bin");
  await mkdir(bin);
  const log = join(root, "calls.jsonl");
  const server = createServer((_req, res) => res.end("ready"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = String((server.address() as { port: number }).port);
  await writeFile(
    join(bin, "docker"),
    `#!${process.execPath}\nconst a=process.argv.slice(2);require('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({args:a})+'\\n');if(a.includes('ps')) console.log('fixture-container');if(a[0]==='exec') console.log(JSON.stringify({busy:false,supported:true}));if(a[0]==='inspect')console.log('[]');if(a[0]==='logs') console.log('http://127.0.0.1:4310/#token=fixture');\n`,
    { mode: 0o755 },
  );
  const result = await command(
    process.execPath,
    [
      join(process.cwd(), "bin/sddclinic.mjs"),
      "start",
      "--port",
      port,
      "--no-open",
      "--data-dir",
      join(root, "custom state"),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        SDDCLINIC_GUI_HOME: join(root, "gui"),
        PATH: `${bin}:${process.env.PATH}`,
      },
    },
  );
  await new Promise<void>((resolve) => server.close(() => resolve()));
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(`http://127.0.0.1:${port}`);
  const calls = (await readFile(log, "utf8"))
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  expect(
    calls.some(
      (c) => c.args.includes("sddclinic-global") && c.args.includes("up"),
    ),
  ).toBe(true);
  const override = await readFile(
    join(root, "gui/projects.compose.yaml"),
    "utf8",
  );
  expect(override).toContain(`127.0.0.1:${port}:4310`);
  expect(override).toContain(join(root, "custom state"));
});
it("invalid invocations fail before Docker execution", async () => {
  for (const args of [
    ["setup", "--guidance-only", "--reasoning", "medium"],
    ["setup", "--guidance-only", "--deep"],
    ["doctor", "--deep"],
    ["doctor", "--rebuild"],
    ["setup", "--guidance-only", "--rebuild"],
    ["doctor", "--model", "unknown"],
    ["setup", "--engine", "other"],
    ["start", "--port", "NaN"],
  ]) {
    const r = await command(process.execPath, [
      join(process.cwd(), "bin/sddclinic.mjs"),
      ...args,
    ]);
    expect(r.code).toBe(2);
    expect(r.stdout).not.toContain("Preparing");
  }
});
it("registers canonical paths once and preserves existing mounts; busy GUI remains pending", async () => {
  const modulePath = join(process.cwd(), "bin/global-gui.mjs");
  const { syncGlobalGui, mountedPath } = await import(modulePath);
  const root = await mkdtemp(join(tmpdir(), "clinic gui "));
  roots.push(root);
  const home = join(root, "gui");
  await mkdir(home);
  const existing = {
    projectName: "existing",
    projectDirectory: root,
    files: [join(root, "compose.yaml")],
    service: "clinic",
    dataDir: "/home/node/.sdd-clinic",
    baseMounts: [
      {
        Type: "bind",
        Source: "/host_mnt/work",
        Destination: "/projects",
        RW: true,
      },
      { Type: "volume", Name: "existing-home", Destination: "/home/node" },
    ],
    adopted: true,
  };
  await writeFile(join(home, "runtime.json"), JSON.stringify(existing));
  expect(mountedPath("/work/app", existing.baseMounts)).toBe("/projects/app");
  expect(mountedPath("/workspace/app", existing.baseMounts)).toBeUndefined();
  let busy = true;
  const calls: string[][] = [];
  const docker = async (args: string[]) => {
    calls.push(args);
    if (args[0] === "inspect")
      return { code: 0, stdout: JSON.stringify([]), stderr: "" };
    if (args.includes("ps"))
      return { code: 0, stdout: "container\n", stderr: "" };
    if (args[0] === "exec" && args.some((s) => s.includes("list('run')")))
      return {
        code: 0,
        stdout: JSON.stringify({ busy, supported: true }),
        stderr: "",
      };
    if (args[0] === "exec")
      return {
        code: 0,
        stdout: JSON.stringify({ id: "project-id", path: args.at(-1) }),
        stderr: "",
      };
    if (args[0] === "logs")
      return {
        code: 0,
        stdout: "http://127.0.0.1:4310/#token=fixture",
        stderr: "",
      };
    return { code: 0, stdout: "", stderr: "" };
  };
  await expect(
    syncGlobalGui(root, "/new/project", {
      home,
      docker,
      ready: async () => true,
    }),
  ).rejects.toThrow("active or waiting");
  expect(calls.some((a) => a.includes("up"))).toBe(false);
  expect(
    JSON.parse(await readFile(join(home, "projects.json"), "utf8"))[0].status,
  ).toBe("pending");
  busy = false;
  const first = await syncGlobalGui(root, undefined, {
    home,
    docker,
    ready: async () => true,
  });
  expect(first.entries[0].status).toBe("registered");
  const second = await syncGlobalGui(root, "/new/project", {
    home,
    docker,
    ready: async () => true,
  });
  expect(second.entries).toHaveLength(1);
  expect(second.entries[0].registration.id).toBe("project-id");
  const override = await readFile(join(home, "projects.compose.yaml"), "utf8");
  expect(override).toContain('"source":"/work","target":"/projects"');
  expect(override).toContain("existing-home");
  expect(override).toContain("/new/project");
});

it.each(["pull", "build", "failed-pull"])(
  "public package runtime selection: %s",
  async (mode) => {
    const root = await mkdtemp(join(tmpdir(), "clinic public launcher "));
    roots.push(root);
    const pkg = join(root, "package");
    await mkdir(pkg);
    await cp(join(process.cwd(), "bin"), join(pkg, "bin"), { recursive: true });
    await writeFile(
      join(pkg, "package.json"),
      JSON.stringify({
        version: "0.1.0",
        sddClinicRuntimeImage: "sintyoa/sdd-clinic:0.1.0",
      }),
    );
    const bin = join(root, "mock-bin");
    await mkdir(bin);
    const log = join(root, "docker.jsonl");
    await writeFile(
      join(bin, "docker"),
      `#!${process.execPath}\nconst a=process.argv.slice(2);require('node:fs').appendFileSync(${JSON.stringify(log)},JSON.stringify({args:a,image:process.env.CLINIC_CLI_IMAGE})+'\\n');if(a.includes('pull')&&${mode === "failed-pull"})process.exit(1);\n`,
      { mode: 0o755 },
    );
    const result = await command(
      process.execPath,
      [join(pkg, "bin/sddclinic.mjs"), "doctor"],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          SDDCLINIC_BUILD: mode === "build" ? "1" : "0",
        },
      },
    );
    const calls = (await readFile(log, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(
      calls.every((call) => call.image === "sintyoa/sdd-clinic:0.1.0"),
    ).toBe(true);
    if (mode === "failed-pull") {
      expect(result.code).toBe(2);
      expect(result.stderr).toContain("SDDCLINIC_BUILD=1");
      expect(
        calls.some(
          (call) => call.args.includes("build") || call.args.includes("run"),
        ),
      ).toBe(false);
    } else {
      expect(result.code).toBe(0);
      expect(calls.some((call) => call.args.includes(mode))).toBe(true);
      expect(
        calls.some((call) =>
          call.args.includes(mode === "build" ? "pull" : "build"),
        ),
      ).toBe(false);
    }
  },
);
