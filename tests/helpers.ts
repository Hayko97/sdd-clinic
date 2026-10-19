import { mkdtemp, writeFile, mkdir, chmod, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Run } from "../src/shared/types.js";
import { Store } from "../src/server/store.js";
import { command } from "../src/server/util.js";

export const tempDir = () => mkdtemp(join(tmpdir(), "sdd-clinic-test-"));
export async function fixtureEngine(root: string) {
  const file = join(root, "fixture-engine.cjs");
  await copyFile(resolve("tests/fixtures/engine.cjs"), file);
  await copyFile(
    resolve("tests/fixtures/setup-quality.cjs"),
    join(root, "setup-quality.cjs"),
  );
  await chmod(file, 0o755);
  return file;
}
export async function waitRun(store: Store, id: string, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const run = store.require<Run>("run", id);
    if (["completed", "failed", "interrupted"].includes(run.status)) return run;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Run ${id} did not finish.`);
}
export async function git(root: string, args: string[]) {
  const result = await command("git", args, { cwd: root });
  if (result.code !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
export async function fixtureRepo(
  root: string,
  language: "typescript" | "python" = "typescript",
) {
  await mkdir(root, { recursive: true });
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Test"]);
  await git(root, ["config", "user.email", "test@localhost"]);
  await writeFile(join(root, ".gitignore"), "__pycache__/\nnode_modules/\n");
  if (language === "typescript") {
    await writeFile(
      join(root, "math.ts"),
      "export function add(a: number, b: number) { return a - b; }\n",
    );
    await writeFile(
      join(root, "check.mts"),
      "import { add } from './math.ts';\nimport assert from 'node:assert/strict';\nassert.equal(add(2, 3), 5);\n",
    );
  } else {
    await writeFile(join(root, "app.py"), "def add(a, b):\n    return a - b\n");
    await writeFile(
      join(root, "check.py"),
      "from app import add\nassert add(2, 3) == 5\n",
    );
  }
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "Baseline application"]);
  const change = join(root, "openspec/changes/fix-addition");
  await mkdir(join(change, "specs/calculator"), { recursive: true });
  await writeFile(join(root, "openspec/config.yaml"), "schema: spec-driven\n");
  await writeFile(
    join(change, ".openspec.yaml"),
    "schema: spec-driven\ncreated: 2026-10-17\n",
  );
  await writeFile(
    join(change, "proposal.md"),
    "# Correct addition\n\n## Why\nAddition currently subtracts the second argument.\n\n## What Changes\n- Correct the addition behavior.\n\n## Capabilities\n### New Capabilities\n- `calculator`: correct addition.\n### Modified Capabilities\nNone.\n\n## Impact\nArithmetic implementation and test.\n",
  );
  await writeFile(
    join(change, "design.md"),
    "# Design\nUse the addition operator. Verify two positive integers.\n",
  );
  await writeFile(
    join(change, "tasks.md"),
    "## Implementation\n- [ ] 1.1 Correct addition and run the test.\n",
  );
  await writeFile(
    join(change, "specs/calculator/spec.md"),
    "## Purpose\nProvide predictable arithmetic results for consumers of the calculator.\n\n## ADDED Requirements\n\n### Requirement: Addition\nThe calculator SHALL add its two integer arguments.\n\n#### Scenario: Adding numbers\n- **WHEN** 2 and 3 are supplied\n- **THEN** the result is 5.\n",
  );
}
