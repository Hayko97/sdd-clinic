import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rename, open, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { createHash, randomUUID } from "node:crypto";
export const guiHome = () =>
  process.env.SDDCLINIC_GUI_HOME || join(homedir(), ".sdd-clinic", "gui");
const digest = (text) =>
  createHash("sha256").update(text).digest("hex").slice(0, 24);
export function mountedPath(hostPath, mounts) {
  const matches = mounts
    .filter((m) => m.Type === "bind")
    .map((m) => {
      const source = m.Source.replace(/^\/host_mnt(?=\/)/, "");
      const rel = relative(source, hostPath);
      return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../")
        ? { path: join(m.Destination, rel), length: source.length }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return matches[0]?.path;
}
async function json(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
async function save(path, value) {
  const tmp = path + ".tmp-" + process.pid;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, path);
}
export function docker(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (b) => (stdout += b));
    p.stderr.on("data", (b) => (stderr += b));
    p.on("error", reject);
    p.on("exit", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
// Used only by the source installer: attach to this checkout's actual GUI, not an arbitrary container.
export async function attachExistingGui(root, home = guiHome()) {
  await mkdir(home, { recursive: true, mode: 0o700 });
  if (await json(join(home, "runtime.json"), null)) return;
  const found = await docker([
    "compose",
    "--project-directory",
    root,
    "-f",
    join(root, "compose.yaml"),
    "ps",
    "-q",
    "clinic",
  ]).catch(() => null);
  if (!found || found.code || !found.stdout.trim()) return;
  const inspected = await docker(["inspect", found.stdout.trim()]);
  if (inspected.code) return;
  const c = JSON.parse(inspected.stdout)[0];
  const labels = c.Config.Labels;
  const env = c.Config.Env ?? [];
  await save(join(home, "runtime.json"), {
    projectName: labels["com.docker.compose.project"],
    projectDirectory: root,
    files: [join(root, "compose.yaml")],
    service: "clinic",
    dataDir:
      env.find((s) => s.startsWith("CLINIC_DATA_DIR="))?.slice(16) ||
      "/home/node/.sdd-clinic",
    initialProject:
      c.Mounts.find(
        (m) => m.Type === "bind" && m.Destination === "/projects",
      )?.Source.replace(/^\/host_mnt(?=\/)/, "") || root,
    baseMounts: c.Mounts,
    adopted: true,
  });
}
const activeScript = `import {Store} from './dist/server/store.js';
import {readFileSync} from 'node:fs';
const store=new Store(process.argv[1]+'/clinic.sqlite');
try {
 store.db.exec('BEGIN IMMEDIATE');
 const busy=store.list('run').some(r=>['running','waiting','queued'].includes(r.status));
 const supported=readFileSync('./dist/server/runs.js','utf8').includes('gui-mount-update');
 if(!busy&&supported)store.put('maintenance',{id:'gui-mount-update',owner:process.argv[2],expiresAt:Date.now()+120000});
 store.db.exec('COMMIT');console.log(JSON.stringify({busy,supported}));
}finally{store.close();}`;
const releaseScript = `import {Store} from './dist/server/store.js';
const store=new Store(process.argv[1]+'/clinic.sqlite');try{if(store.get('maintenance','gui-mount-update')?.owner===process.argv[2])store.delete('maintenance','gui-mount-update');}finally{store.close();}`;
const registerScript = `import {Store} from './dist/server/store.js';
import {Projects} from './dist/server/projects.js';
const store=new Store(process.argv[1]+'/clinic.sqlite');
try {const projects=new Projects(store);const p=await projects.add(process.argv[2],'codex');const config=await projects.config(p);const saved=store.put('project',{...p,name:config.name,engine:config.engine});console.log(JSON.stringify({id:saved.id,path:saved.path,name:saved.name}));}finally{store.close();}`;
export function makeOverride(runtime, entries, options = {}) {
  const volumes = [];
  const definitions = {};
  for (const mount of runtime.baseMounts ?? []) {
    if (mount.Type === "bind")
      volumes.push({
        type: "bind",
        source: mount.Source.replace(/^\/host_mnt(?=\/)/, ""),
        target: mount.Destination,
        read_only: !mount.RW,
      });
    if (mount.Type === "volume") {
      const key = "existing-" + digest(mount.Name);
      definitions[key] = { external: true, name: mount.Name };
      volumes.push({ type: "volume", source: key, target: mount.Destination });
    }
  }
  for (const item of entries)
    if (!mountedPath(item.hostPath, runtime.baseMounts ?? []))
      volumes.push({
        type: "bind",
        source: item.hostPath,
        target: item.containerPath,
      });
  if (options.dataDir)
    volumes.push({
      type: "bind",
      source: options.dataDir,
      target: "/clinic-data",
    });
  const service = {
    ...(!runtime.adopted && options.image ? { image: options.image } : {}),
    volumes,
    environment: {
      CLINIC_DATA_DIR: options.dataDir ? "/clinic-data" : runtime.dataDir,
    },
  };
  let text = `services:\n  ${runtime.service}:\n`;
  for (const [key, value] of Object.entries(service))
    text += `    ${key}: ${JSON.stringify(value)}\n`;
  if (options.port)
    text += `    ports: !override ${JSON.stringify([`127.0.0.1:${options.port}:4310`])}\n`;
  text += `volumes: ${JSON.stringify(definitions)}\n`;
  return text;
}
export async function syncGlobalGui(root, hostPath, options = {}) {
  const home = options.home ?? guiHome();
  const exec = options.docker ?? docker;
  await mkdir(home, { recursive: true, mode: 0o700 });
  const manifestPath = join(home, "projects.json");
  // Persist intent before any Docker operation, so a failed synchronization remains retryable.
  const lockPath = join(home, "sync.lock");
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch {
    throw new Error(
      `GUI sync is already active. Retry sddclinic start; after a crashed sync remove ${lockPath} only if no sync is running.`,
    );
  }
  let maintenanceContainer, maintenanceDataDir;
  const owner = randomUUID();
  try {
    let runtime = await json(join(home, "runtime.json"), null);
    if (!runtime) {
      runtime = {
        projectName: "sddclinic-global",
        projectDirectory: root,
        files: [join(root, "runtime/compose.yaml")],
        service: "clinic",
        dataDir: "/home/node/.sdd-clinic/global",
        initialProject: hostPath ?? process.cwd(),
        baseMounts: [],
        adopted: false,
      };
      await save(join(home, "runtime.json"), runtime);
    }
    // Packaged runtimes follow the currently installed artifact, while adopted source GUIs keep their checkout.
    if (!runtime.adopted) {
      runtime.projectDirectory = root;
      runtime.files = [join(root, "runtime/compose.yaml")];
    }
    const entries = await json(manifestPath, []);
    if (hostPath && !entries.some((p) => p.hostPath === hostPath))
      entries.push({
        hostPath,
        containerPath:
          mountedPath(hostPath, runtime.baseMounts) ||
          `/clinic-projects/${digest(hostPath)}`,
        status: "pending",
      });
    await save(manifestPath, entries);
    const overridePath = join(home, "projects.compose.yaml");
    const selected = {
      image: options.image ?? runtime.image,
      port: options.port ?? runtime.port,
      dataDir: options.dataDir ?? runtime.customDataDir,
    };
    const override = makeOverride(runtime, entries, selected);
    const signature = digest(override);
    const env = {
      ...process.env,
      CLINIC_CLI_PROJECT: runtime.initialProject,
      CLINIC_CLI_IMAGE: selected.image || "sddclinic-terminal:0.1.0",
      CLINIC_CLI_UID: String(process.getuid?.() ?? 1000),
      CLINIC_CLI_GID: String(process.getgid?.() ?? 1000),
      CLINIC_CLI_PORT: "4310",
    };
    const base = [
      "compose",
      "--project-name",
      runtime.projectName,
      "--project-directory",
      runtime.projectDirectory,
      ...runtime.files.flatMap((f) => ["-f", f]),
    ];
    const running = await exec([...base, "ps", "-q", runtime.service], env);
    if (running.code)
      throw new Error(
        "Cannot inspect the global GUI runtime. Registration remains pending.",
      );
    let container = running.stdout.trim().split("\n")[0];
    let actualMounts = [];
    if (container) {
      const inspected = await exec(
        ["inspect", "--format", "{{json .Mounts}}", container],
        env,
      );
      if (inspected.code)
        throw new Error(
          "Cannot inspect the global GUI mounts; registration remains pending.",
        );
      actualMounts = JSON.parse(inspected.stdout);
    }
    const accessible = entries.every(
      (entry) =>
        mountedPath(entry.hostPath, actualMounts) === entry.containerPath,
    );
    const needsUpdate =
      !container || runtime.signature !== signature || !accessible;
    if (container && needsUpdate) {
      const active = await exec(
        [
          "exec",
          container,
          "node",
          "--input-type=module",
          "-e",
          activeScript,
          runtime.customDataDir ? "/clinic-data" : runtime.dataDir,
          owner,
        ],
        env,
      );
      if (active.code)
        throw new Error(
          "Cannot verify that the global GUI is idle. Registration remains pending; retry sddclinic start.",
        );
      const state = JSON.parse(active.stdout);
      if (!state.supported)
        throw new Error(
          "This GUI version needs an update before safe mount changes. Update its Docker image, then run sddclinic start; registration remains pending.",
        );
      if (state.busy)
        throw new Error(
          "The global GUI has active or waiting agent work. Setup is saved; GUI registration is pending. Finish that work, then run sddclinic start.",
        );
    }
    if (container && needsUpdate) {
      maintenanceContainer = container;
      maintenanceDataDir = runtime.customDataDir
        ? "/clinic-data"
        : runtime.dataDir;
    }
    if (needsUpdate) {
      if (selected.dataDir)
        await mkdir(selected.dataDir, { recursive: true, mode: 0o700 });
      await writeFile(overridePath, override, { mode: 0o600 });
      const up = await exec(
        [
          ...base,
          "-f",
          overridePath,
          "up",
          "-d",
          "--no-build",
          runtime.service,
        ],
        env,
      );
      if (up.code)
        throw new Error(
          `Global GUI could not start. Registration remains pending; retry sddclinic start. ${up.stderr.slice(-1200)}`,
        );
      const found = await exec(
        [...base, "-f", overridePath, "ps", "-q", runtime.service],
        env,
      );
      container = found.stdout.trim().split("\n")[0];
      if (found.code || !container)
        throw new Error(
          "The global GUI did not become available; registration remains pending.",
        );
      if (maintenanceContainer) maintenanceContainer = container;
      runtime = {
        ...runtime,
        signature,
        image: selected.image,
        port: selected.port,
        customDataDir: selected.dataDir,
      };
      await save(join(home, "runtime.json"), runtime);
    }
    for (const entry of entries) {
      const result = await exec(
        [
          "exec",
          ...(runtime.adopted
            ? []
            : ["--user", `${env.CLINIC_CLI_UID}:${env.CLINIC_CLI_GID}`]),
          container,
          "node",
          "--input-type=module",
          "-e",
          registerScript,
          selected.dataDir ? "/clinic-data" : runtime.dataDir,
          entry.containerPath,
        ],
        env,
      );
      if (result.code) {
        entry.status = "pending";
        await save(manifestPath, entries);
        throw new Error(
          `GUI cannot access ${entry.hostPath}. Registration remains pending. ${result.stderr.slice(-700)}`,
        );
      }
      entry.registration = JSON.parse(result.stdout);
      entry.status = "registered";
      await save(manifestPath, entries);
    }
    let publicUrl;
    for (let attempt = 0; attempt < 40; attempt++) {
      const logs = await exec(["logs", "--tail", "1000", container], env);
      const url = (logs.stdout + "\n" + logs.stderr)
        .match(/http:\/\/127\.0\.0\.1:\d+\/#token=[a-zA-Z0-9_-]+/g)
        ?.at(-1);
      if (url) {
        const candidate = url.replace(
          /127\.0\.0\.1:\d+/,
          `127.0.0.1:${selected.port ?? 4310}`,
        );
        // Verify readiness through the same host port the user will open.
        const ready = await (
          options.ready ??
          (async (address) => {
            try {
              return (
                await fetch(address.split("/#")[0], {
                  signal: AbortSignal.timeout(1500),
                })
              ).ok;
            } catch {
              return false;
            }
          })
        )(candidate);
        if (ready) {
          publicUrl = candidate;
          break;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!publicUrl)
      throw new Error(
        "Project registration is saved, but the global GUI has no ready authenticated launch URL. Check its Docker logs and retry sddclinic start.",
      );
    return { url: publicUrl, entries, container };
  } finally {
    if (maintenanceContainer)
      await exec([
        "exec",
        maintenanceContainer,
        "node",
        "--input-type=module",
        "-e",
        releaseScript,
        maintenanceDataDir,
        owner,
      ]).catch(() => {});
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
