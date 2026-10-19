import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import {
  mkdir,
  writeFile,
  readFile,
  rm,
  copyFile,
  chmod,
} from "node:fs/promises";
import { createApp } from "../../src/server/app.js";
import { SecretVault } from "../../src/server/data.js";
import { fixtureEngine, fixtureRepo, tempDir } from "../helpers.js";
const root = await tempDir();
const sqlite = join(root, "browser.sqlite");
const database = new DatabaseSync(sqlite);
database.exec("CREATE TABLE events(id INTEGER)");
database.close();
const repo = join(root, "project");
const secondRepo = join(root, "second-project");
const workflowRepo = join(root, "workflow-project");
const baselineRepo = join(root, "baseline-project");
await mkdir(
  join(baselineRepo, "packages/shop/src/features/products/internal"),
  { recursive: true },
);
await mkdir(join(baselineRepo, "docs"));
await writeFile(
  join(baselineRepo, "packages/shop/src/features/products/internal/catalog.ts"),
  "export const active = products => products.filter(product => product.active);\n",
);
await writeFile(
  join(baselineRepo, "docs/catalog.md"),
  "# Product catalog\nShow active products to visitors. An empty catalog shows no items.\n",
);
await fixtureRepo(workflowRepo);
await mkdir(secondRepo);
await fixtureRepo(repo);
await mkdir(join(repo, "openspec/specs/onboarding"), { recursive: true });
await writeFile(
  join(repo, "openspec/specs/onboarding/spec.md"),
  "# Project onboarding\n\n## Purpose\nHelp developers bring clear intent to their projects.\n\n## Requirements\n\n### Requirement: Project discovery\nThe application SHALL inspect a selected project and present its detected structure for review.\n\n#### Scenario: Adding an existing project\n- **WHEN** a developer selects a local repository\n- **THEN** the application shows the project structure and proposed SDD setup.\n",
);
const engine = await fixtureEngine(root);
const archived = join(repo, "openspec/changes/archive/2026-10-01-onboarding");
await mkdir(join(archived, "specs/onboarding"), { recursive: true });
await writeFile(
  join(archived, "specs/onboarding/spec.md"),
  await readFile(join(repo, "openspec/specs/onboarding/spec.md")),
);
for (const name of ["proposal", "design", "research", "validation", "tasks"])
  await writeFile(
    join(archived, `${name}.md`),
    `# Archived onboarding ${name}\nHistorical fixture document for project setup.\n`,
  );
const authEngine = join(root, "auth-engine.cjs");
await copyFile(engine, authEngine);
await chmod(authEngine, 0o755);
const clinic = await createApp({
  dataDir: join(root, "state"),
  discover: false,
  vault: new SecretVault(false),
});
clinic.store.put("engine", { id: "codex", path: engine, connected: false });
clinic.store.put("engine", { id: "claude", path: engine, connected: false });
clinic.app.get("/test/bootstrap", async () => ({
  token: clinic.bootstrapToken,
  engine,
  sqlite,
  repo,
  secondRepo,
  workflowRepo,
  baselineRepo,
  newProjectPath: join(root, "new-product"),
  node: process.execPath,
  authEngine,
  authMode: join(root, "fixture-auth-mode"),
}));
const address = await clinic.app.listen({ host: "127.0.0.1", port: 4319 });
clinic.runs.baseUrl = address;
const close = async () => {
  await clinic.app.close();
  await rm(root, { recursive: true, force: true });
};
process.on("SIGTERM", () => void close());
process.on("SIGINT", () => void close());
