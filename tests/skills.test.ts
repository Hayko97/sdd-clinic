import { afterEach, expect, it } from "vitest";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/data.js";
import type { EngineAdapter } from "../src/shared/types.js";
import { fixtureRepo, tempDir, waitRun } from "./helpers.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
it("uses the project's customized refine skill for existing specs and blocks missing skill dispatch", async () => {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  let prompt = "";
  let calls = 0;
  const provider: EngineAdapter = {
    async probe() {
      throw new Error("Not used");
    },
    async run(_path, request) {
      calls++;
      prompt = request.prompt;
      return {
        sessionId: "refine-test",
        text: JSON.stringify({
          summary: "Refine terminology",
          files: [
            {
              path: "openspec/changes/fix-addition/proposal.md",
              content: "## Why\nClarify behavior.\n",
            },
          ],
        }),
      };
    },
  };
  const clinic = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
    providers: { codex: provider, claude: provider },
  });
  cleanup.push(() => clinic.app.close());
  clinic.store.put("engine", { id: "codex", path: "fixture", connected: true });
  const project = await clinic.projects.add(repo, "codex");
  const input = {
    path: "openspec/changes/fix-addition/specs/calculator/spec.md",
    prompt: "Clarify terminology",
  };
  await expect(clinic.runs.chat(project, input)).rejects.toThrow("Set up SDD");
  expect(calls).toBe(0);
  const setup = await clinic.projects.setupFiles(project);
  const proposal = await clinic.specs.propose(
    project,
    "Setup",
    setup.files,
    "setup",
  );
  await clinic.specs.apply(project, proposal.id);
  await writeFile(
    join(repo, ".clinic/skills/refine-spec/SKILL.md"),
    "---\nname: refine-spec\ndescription: Project-specific refinement\n---\nUse the term verified sum.\n",
  );
  const { run } = await clinic.runs.chat(project, input);
  const result = await waitRun(clinic.store, run.id);
  expect(result.error).toBeUndefined();
  expect(result.skillName).toBe("refine-spec");
  expect(prompt).toContain("Use the term verified sum.");
  expect(prompt).not.toContain("# create-spec");
  expect(calls).toBe(1);
});
