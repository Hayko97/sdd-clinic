import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (!pkg.license || pkg.license === "UNLICENSED")
  throw Error("Choose an open-source license before packing a public release.");
const output = resolve(process.argv[2] || join(root, "releases"));
const image =
  process.env.SDDCLINIC_RELEASE_IMAGE || `sintyoa/sdd-clinic:${pkg.version}`;
if (!/^[a-z0-9][a-z0-9./_-]+:[a-zA-Z0-9._-]+$/.test(image) || !image.endsWith(`:${pkg.version}`))
  throw Error("Invalid release image reference.");
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "clinic-public-pack-"));
function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`${cmd} failed (${r.status})`);
}
try {
  run("pnpm", ["pack", "--pack-destination", temp]);
  run("tar", [
    "-xzf",
    join(temp, `${pkg.name}-${pkg.version}.tgz`),
    "-C",
    temp,
  ]);
  const manifest = JSON.parse(
    await readFile(join(temp, "package/package.json"), "utf8"),
  );
  // Docker has the original manifest; host entrypoints use only Node built-ins.
  for (const key of [
    "dependencies",
    "devDependencies",
    "scripts",
    "packageManager",
  ])
    delete manifest[key];
  manifest.sddClinicRuntimeImage = image;
  await writeFile(
    join(temp, "package/package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  const tarball = join(output, `${pkg.name}-${pkg.version}.tgz`);
  run("tar", ["-czf", tarball, "-C", temp, "package"]);
  console.log(`Public CLI + GUI package: ${tarball}\nRuntime image: ${image}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
