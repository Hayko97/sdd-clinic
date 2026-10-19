import { describe, it, expect, afterEach } from "vitest";
import { join, resolve } from "node:path";
import { readFile, rm, utimes, writeFile } from "node:fs/promises";
import { Store } from "../src/server/store.js";
import { Projects } from "../src/server/projects.js";
import { SpecRepository } from "../src/server/specs.js";
import { ConnectionBroker, SecretVault } from "../src/server/data.js";
import { Runs } from "../src/server/runs.js";
import type { ChangeRecord, EngineConfig, Run } from "../src/shared/types.js";
import {
  fixtureEngine,
  fixtureRepo,
  git,
  tempDir,
  waitRun,
} from "./helpers.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
describe("spec-to-delivery acceptance", () => {
  for (const language of ["typescript", "python"] as const)
    it(`implements and verifies an isolated ${language} project, then tracks integration`, async () => {
      const root = await tempDir();
      roots.push(root);
      const repo = join(root, "repo");
      await fixtureRepo(repo, language);
      await writeFile(
        join(repo, "personal-notes.txt"),
        "Uncommitted user work",
      );
      const store = new Store(":memory:"),
        projects = new Projects(store),
        specs = new SpecRepository(store),
        broker = new ConnectionBroker(store, new SecretVault(false)),
        runs = new Runs(store, projects, specs, broker, root);
      const executable = await fixtureEngine(root);
      store.put<EngineConfig>("engine", {
        id: "codex",
        path: executable,
        connected: true,
      });
      const project = await projects.add(repo, "codex");
      await projects.saveConfig(project, {
        name: language,
        engine: "codex",
        commands: [
          {
            name: "Addition check",
            command:
              language === "typescript" ? process.execPath : "/usr/bin/python3",
            args: [language === "typescript" ? "check.mts" : "check.py"],
            cwd: ".",
            phase: "check",
          },
        ],
      });
      await specs.approve(project, "fix-addition");
      const run = await runs.develop(project, "fix-addition");
      const dev = await waitRun(store, run.id);
      expect(dev.error).toBeUndefined();
      expect(dev.status).toBe("completed");
      const change = specs.change(project, "fix-addition");
      expect(change.worktree).toBeTruthy();
      const qa = await waitRun(store, change.qaRunId!);
      expect(qa.error).toBeUndefined();
      expect(qa.qa?.verdict).toBe("passed");
      expect(specs.change(project, "fix-addition").state).toBe("review");
      const indexPath = resolve(
        change.worktree!,
        await git(change.worktree!, ["rev-parse", "--git-path", "index"]),
      );
      const indexBefore = await readFile(indexPath);
      const touched = new Date(Date.now() + 1000);
      await utimes(
        join(
          change.worktree!,
          language === "typescript" ? "math.ts" : "app.py",
        ),
        touched,
        touched,
      );
      expect((await runs.review(project, "fix-addition")).qaCurrent).toBe(true);
      expect(await readFile(indexPath)).toEqual(indexBefore);
      expect(await readFile(join(repo, "personal-notes.txt"), "utf8")).toBe(
        "Uncommitted user work",
      );
      expect(
        await readFile(
          join(repo, language === "typescript" ? "math.ts" : "app.py"),
          "utf8",
        ),
      ).toContain("a - b");
      await expect(
        readFile(join(change.worktree!, "personal-notes.txt")),
      ).rejects.toThrow();
      await writeFile(
        join(change.worktree!, "external-edit.txt"),
        "Changed after QA",
      );
      await expect(runs.finalize(project, "fix-addition")).rejects.toThrow(
        "uncommitted changes",
      );
      await rm(join(change.worktree!, "external-edit.txt"));
      expect((await runs.review(project, "fix-addition")).diff).toContain(
        "a + b",
      );
      expect((await runs.review(project, "fix-addition")).qaCurrent).toBe(true);
      if (language === "typescript") {
        await writeFile(
          join(change.worktree!, "review-note.txt"),
          "Manual follow-up after QA",
        );
        await git(change.worktree!, ["add", "review-note.txt"]);
        await git(change.worktree!, [
          "commit",
          "-m",
          "Manual review follow-up",
        ]);
        expect((await runs.review(project, "fix-addition")).qaCurrent).toBe(
          false,
        );
        const repeat = await runs.retryQa(project, "fix-addition");
        const report = await waitRun(store, repeat.id);
        expect(report.qa?.verdict).toBe("passed");
        expect(report.codeRevision).not.toBe(qa.codeRevision);
      }
      const final = await runs.finalize(project, "fix-addition");
      expect(
        (await specs.validate({ ...project, path: final.worktree! })).code,
      ).toBe(0);
      expect(final.state).toBe("ready-to-integrate");
      await expect(
        runs.verifyIntegration(project, "fix-addition"),
      ).rejects.toThrow("not yet an ancestor");
      // Simulate the developer integrating the reviewed branch through Git.
      await git(repo, ["add", "openspec", ".clinic"]);
      await git(repo, ["commit", "-m", "Save approved project specifications"]);
      await git(repo, ["merge", "--no-edit", final.branch!]);
      expect(
        (await runs.verifyIntegration(project, "fix-addition")).state,
      ).toBe("done");
      store.close();
    });
  for (const expected of ["failed", "unverified"] as const)
    it(`keeps ${expected} QA distinct and records a linked finding`, async () => {
      const root = await tempDir();
      roots.push(root);
      const repo = join(root, "repo");
      await fixtureRepo(repo);
      const store = new Store(":memory:"),
        projects = new Projects(store),
        specs = new SpecRepository(store),
        broker = new ConnectionBroker(store, new SecretVault(false)),
        runs = new Runs(store, projects, specs, broker, root);
      store.put("engine", {
        id: "codex",
        path: await fixtureEngine(root),
        connected: true,
      });
      const project = await projects.add(repo, "codex");
      await projects.saveConfig(project, {
        name: "Fixture",
        engine: "codex",
        commands: [
          {
            name: "Required check",
            command:
              expected === "failed"
                ? process.execPath
                : "/nonexistent/test-runner",
            args: expected === "failed" ? ["-e", "process.exit(1)"] : [],
            phase: "check",
          },
        ],
      });
      await specs.approve(project, "fix-addition");
      const dev = await runs.develop(project, "fix-addition");
      await waitRun(store, dev.id);
      const qa = await waitRun(
        store,
        specs.change(project, "fix-addition").qaRunId!,
      );
      expect(qa.qa?.verdict).toBe(expected);
      expect(specs.change(project, "fix-addition").state).toBe("ready");
      expect(store.list<any>("finding", project.id)[0].kind).toBe(
        expected === "failed" ? "bug" : "investigation",
      );
      await expect(runs.finalize(project, "fix-addition")).rejects.toThrow(
        "passed QA",
      );
      store.close();
    });
  it("persists events before delivery and preserves interrupted runs across restart", async () => {
    const root = await tempDir();
    roots.push(root);
    const path = join(root, "state.sqlite");
    let store = new Store(path);
    store.put<Run>("run", {
      id: "run",
      projectId: "p",
      kind: "chat",
      title: "Work",
      engine: "codex",
      status: "running",
      startedAt: new Date().toISOString(),
    });
    store.put<ChangeRecord>("change", {
      id: "p:change",
      projectId: "p",
      name: "change",
      state: "developing",
      approvedHash: "approved",
      worktree: "/preserved/worktree",
      updatedAt: new Date().toISOString(),
    });
    store.events.on("run", (event) =>
      expect(store.replay("run")).toContainEqual(event),
    );
    const first = store.append("run", "message", { delta: "Partial output" });
    store.close();
    store = new Store(path);
    store.recover();
    expect(store.require<Run>("run", "run").status).toBe("interrupted");
    expect(store.require<ChangeRecord>("change", "p:change")).toMatchObject({
      state: "ready",
      worktree: "/preserved/worktree",
      approvedHash: "approved",
    });
    expect(store.replay("run", first.id).map((e) => e.type)).toEqual([
      "interrupted",
    ]);
    store.close();
  });
});
