import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { inventoryProject } from "../src/server/project-inventory.js";
import { command, cleanEnv } from "../src/server/util.js";
import * as util from "../src/server/util.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
it.each([false, true])(
  "prunes native dependencies before limits while preserving project evidence (tracked=%s)",
  async (tracked) => {
    const root = await mkdtemp(join(tmpdir(), "clinic-native-inventory-"));
    roots.push(root);
    const write = async (path: string, content: string) => {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), content);
    };
    const excluded = [
      "ios/Pods",
      "ios/DerivedData",
      "android/.gradle",
      "android/app/.cxx",
      "apps/mobile/.expo",
      "packages/mobile/.dart_tool",
      "packages/native/.build",
    ];
    const authored = [
      "ios/Podfile",
      "ios/Podfile.lock",
      "ios/App/AppDelegate.swift",
      "ios/App.xcodeproj/project.pbxproj",
      "android/build.gradle",
      "android/app/src/main/App.kt",
      "packages/native/Package.swift",
    ];
    for (const path of excluded) {
      await write(`${path}/large.txt`, "dependency".repeat(1000));
      // A traversal would exceed the entry budget even if file contents were ignored.
      for (let i = 0; i < 50; i++)
        await write(`${path}/deep/entry${i}.hpp`, "dependency");
    }
    for (const path of authored) await write(path, "authored evidence\n");
    if (tracked) {
      expect((await command("git", ["init"], { cwd: root })).code).toBe(0);
      expect((await command("git", ["add", "."], { cwd: root })).code).toBe(0);
    }
    const inventory = () =>
      inventoryProject({ path: root }, undefined, {
        entries: 45,
        fileBytes: 100,
        totalBytes: 500,
      });
    const before = await inventory();
    expect(before.files.map((f) => f.path).sort()).toEqual(authored.sort());
    for (const path of excluded)
      expect(before.excluded).toContainEqual({
        path,
        reason: "dependency, generated output or internal data directory",
      });
    await write("ios/Pods/large.txt", "changed dependency".repeat(10000));
    expect((await inventory()).fingerprint).toBe(before.fingerprint);
    await write("ios/App/AppDelegate.swift", "changed authored code\n");
    expect((await inventory()).fingerprint).not.toBe(before.fingerprint);
  },
);

it("honors ignored generated content when Git reports a different repository owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "clinic-owner-inventory-"));
  roots.push(root);
  await command("git", ["init"], { cwd: root });
  await writeFile(join(root, ".gitignore"), "artifacts/\n");
  await writeFile(join(root, "app.ts"), "authored evidence\n");
  await mkdir(join(root, "artifacts"));
  await writeFile(join(root, "artifacts", "bundle.js"), "output".repeat(1000));
  const originalCommand = util.command;
  const spy = vi
    .spyOn(util, "command")
    .mockImplementation((cmd, args, options = {}) =>
      originalCommand(cmd, args, {
        ...options,
        env: {
          ...cleanEnv(),
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_TEST_ASSUME_DIFFERENT_OWNER: "1",
        },
      }),
    );
  try {
    const rejected = await command("git", ["ls-files"], { cwd: root });
    expect(rejected.code).not.toBe(0);
    const result = await inventoryProject({ path: root }, undefined, {
      entries: 20,
      fileBytes: 100,
      totalBytes: 500,
    });
    expect(result.files.map((f) => f.path)).toEqual([".gitignore", "app.ts"]);
    expect(result.excluded).toContainEqual({
      path: "artifacts",
      reason: "Git-ignored path",
    });
  } finally {
    spy.mockRestore();
  }
});
