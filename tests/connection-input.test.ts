import { afterEach, expect, it } from "vitest";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { parseConnectionInput } from "../src/server/connection-input.js";
import { containsConnectionDetails } from "../src/shared/connection-input.js";
import { SecretVault } from "../src/server/vault.js";
import { createApp } from "../src/server/app.js";
import { fixtureRepo, fixtureEngine, tempDir, waitRun } from "./helpers.js";
import type { ConnectionProfile } from "../src/shared/types.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
it.each([
  [
    "postgresql://reader:p%40ss-word@db.example:5432/app?sslmode=disable",
    "postgres",
    "p@ss-word",
  ],
  [
    'DB_CONNECTION=mysql\nDB_HOST=db.example\nDB_USERNAME=reader\nDB_PASSWORD="two words"\nDB_DATABASE=app',
    "mysql",
    "two words",
  ],
  [
    "mongodb+srv://reader:mongo-secret@cluster.example/app?authSource=admin",
    "mongodb",
    "mongo-secret",
  ],
  [
    'ssh reader@server.example -p 2222\npassword: "ssh-secret"\nfingerprint: SHA256:known\npaths: /var/log/app,/srv/app/schema',
    "ssh",
    "ssh-secret",
  ],
  [
    '{"type":"postgres","host":"db.example","user":"reader","password":"json-secret"}',
    "postgres",
    "json-secret",
  ],
])("parses supported credentials locally: %s", (input, kind, password) => {
  expect(containsConnectionDetails(input)).toBe(true);
  const parsed = parseConnectionInput(input);
  expect(parsed.profile.kind).toBe(kind);
  expect(parsed.secret.password).toBe(password);
  expect(JSON.stringify(parsed.profile)).not.toContain(password);
});
it("accepts SQLite paths and SSH key blocks, but rejects ambiguous or unsupported data without echoing it", () => {
  expect(
    parseConnectionInput("sqlite:///projects/data.sqlite").profile.path,
  ).toBe("/projects/data.sqlite");
  expect(
    parseConnectionInput(
      "ssh reader@server\n-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-material\n-----END OPENSSH PRIVATE KEY-----",
    ).secret.privateKey,
  ).toContain("private-material");
  for (const input of [
    "https://user:private-secret@host",
    "postgres://a:b@one/x mysql://a:b@two/y",
    "password: private-secret",
    "type: nonsense\nhost: private-secret",
  ]) {
    let error = "";
    try {
      parseConnectionInput(input);
    } catch (e) {
      error = (e as Error).message;
    }
    expect(error).toContain("Paste one");
    expect(error).not.toContain("private-secret");
  }
});
it("persists encrypted secrets across restart, detects tampering and removes saved values", async () => {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, "vault");
  const vault = new SecretVault(false, dir);
  expect(
    await vault.set("connection", { password: "long-private-password" }),
  ).toBe("encrypted");
  expect((await stat(join(dir, "vault.key"))).mode & 0o777).toBe(0o600);
  const files = await readdir(dir);
  const file = join(
    dir,
    files.find((f) => f.endsWith(".enc"))!,
  );
  const ciphertext = await readFile(file, "utf8");
  expect(ciphertext).not.toContain("long-private-password");
  const restarted = new SecretVault(false, dir);
  expect(await restarted.get("connection", "encrypted")).toEqual({
    password: "long-private-password",
  });
  const value = JSON.parse(ciphertext);
  value.tag = Buffer.alloc(16).toString("base64");
  await writeFile(file, JSON.stringify(value));
  await expect(
    new SecretVault(false, dir).get("connection", "encrypted"),
  ).rejects.toThrow("Re-enter");
  await restarted.delete("connection");
  expect(await readdir(dir)).toEqual(["vault.key"]);
  await expect(
    new SecretVault(false, dir).get("connection", "encrypted"),
  ).rejects.toThrow("Re-enter");
  const blocked = join(root, "blocked");
  await writeFile(blocked, "not a directory");
  expect(
    await new SecretVault(false, blocked).set("c", { password: "fallback" }),
  ).toBe("session");
});
it("imports, updates and scopes credentials without a provider or persisted prompt", async () => {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  const clinic = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false, join(root, "vault")),
  });
  cleanup.push(() => clinic.app.close());
  const project = await clinic.projects.add(repo, "codex");
  const setup = await clinic.projects.setupFiles(project);
  await clinic.specs.apply(
    project,
    (await clinic.specs.propose(project, "setup", setup.files, "setup")).id,
  );
  const session = await clinic.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: clinic.bootstrapToken },
  });
  const headers = { cookie: `clinic_session=${session.cookies[0]!.value}` };
  const endpoint = `/api/projects/${project.id}/connection-prompt`;
  expect(
    (
      await clinic.app.inject({
        method: "POST",
        url: endpoint,
        payload: { prompt: "password: hidden", agentId: "developer" },
      })
    ).statusCode,
  ).toBe(401);
  const saved = await clinic.app.inject({
    method: "POST",
    url: endpoint,
    headers,
    payload: {
      prompt: "postgres://reader:private-password@db.example/app",
      agentId: "developer",
    },
  });
  expect(saved.statusCode).toBe(200);
  const profile = saved.json().connection as ConnectionProfile;
  expect(profile.agentIds).toEqual(["developer"]);
  expect(profile.secretStorage).toBe("encrypted");
  expect(
    (await clinic.projects.agents(project)).find((a) => a.id === "developer")
      ?.tools,
  ).toContain("data");
  const updated = await clinic.app.inject({
    method: "POST",
    url: endpoint,
    headers,
    payload: {
      prompt: "password: changed-password",
      agentId: "po",
      connectionId: profile.id,
    },
  });
  expect(updated.statusCode).toBe(200);
  expect(updated.json().connection.id).toBe(profile.id);
  expect(updated.json().connection.agentIds).toEqual(["developer", "po"]);
  expect(await clinic.broker.vault.get(profile.id, "encrypted")).toEqual({
    password: "changed-password",
  });
  expect(clinic.store.list("connection", project.id)).toHaveLength(1);
  const duplicate = await clinic.app.inject({
    method: "POST",
    url: endpoint,
    headers,
    payload: {
      prompt: "postgres://reader:third-password@db.example/app",
      agentId: "developer",
    },
  });
  expect(duplicate.json().connection.id).toBe(profile.id);
  const bad = await clinic.app.inject({
    method: "POST",
    url: endpoint,
    headers,
    payload: { prompt: "password: private-password", agentId: "unknown" },
  });
  expect(bad.statusCode).toBe(404);
  expect(bad.body).not.toContain("private-password");
  const other = await clinic.projects.add(root, "codex");
  expect(
    (
      await clinic.app.inject({
        method: "POST",
        url: `/api/projects/${other.id}/connection-prompt`,
        headers,
        payload: {
          prompt: "password: private-password",
          agentId: "developer",
          connectionId: profile.id,
        },
      })
    ).statusCode,
  ).toBe(404);
  await expect(
    clinic.workflows.start(
      project,
      "postgres://reader:private-password@db.example/app",
    ),
  ).rejects.toThrow("Save connection");
  const snapshot = (
    await clinic.app.inject({ url: `/api/projects/${project.id}`, headers })
  ).body;
  for (const secret of [
    "private-password",
    "changed-password",
    "third-password",
  ])
    expect(snapshot).not.toContain(secret);
  expect(clinic.store.list("workflow")).toHaveLength(0);
  expect(clinic.store.list("run")).toHaveLength(0);
});
it("lets an assigned Developer use real SQLite MCP tools and rejects other agents and projects", async () => {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  const clinic = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
  });
  cleanup.push(() => clinic.app.close());
  const project = await clinic.projects.add(repo, "codex");
  const setup = await clinic.projects.setupFiles(project);
  await clinic.specs.apply(
    project,
    (await clinic.specs.propose(project, "setup", setup.files, "setup")).id,
  );
  const developer = (await clinic.projects.agents(project)).find(
    (a) => a.role === "developer",
  )!;
  await clinic.projects.saveAgent(project, {
    ...developer,
    tools: [...developer.tools, "data"],
  });
  const sqlite = join(root, "events.sqlite");
  const db = new DatabaseSync(sqlite);
  db.exec("CREATE TABLE events(id INTEGER); INSERT INTO events VALUES(1),(2)");
  db.close();
  const assigned = await clinic.broker.save(
    project.id,
    {
      name: "Events",
      kind: "sqlite",
      path: sqlite,
      agentIds: [developer.id],
      readOnlyConfirmed: true,
    },
    {},
  );
  const other = await clinic.broker.save(
    project.id,
    {
      name: "Private PO",
      kind: "sqlite",
      path: sqlite,
      agentIds: ["po"],
      readOnlyConfirmed: true,
    },
    {},
  );
  const foreign = await clinic.broker.save(
    "another-project",
    {
      name: "Foreign",
      kind: "sqlite",
      path: sqlite,
      agentIds: [developer.id],
      readOnlyConfirmed: true,
    },
    {},
  );
  clinic.store.put("engine", {
    id: "codex",
    path: await fixtureEngine(root),
    connected: true,
  });
  const flow = await clinic.workflows.start(project, "HANG inspect source");
  const address = await clinic.app.listen({ host: "127.0.0.1", port: 0 });
  const client = new Client({ name: "connection-test", version: "1" });
  cleanup.push(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${address}/mcp/${flow.runId}`), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${clinic.runs.active.get(flow.runId!)!.token}`,
        },
      },
    }),
  );
  expect(
    JSON.stringify(
      await client.callTool({ name: "list_connections", arguments: {} }),
    ),
  ).toContain("Events");
  expect(
    JSON.stringify(
      await client.callTool({ name: "list_connections", arguments: {} }),
    ),
  ).not.toContain("Private PO");
  expect(
    (
      await client.callTool({
        name: "test_connection",
        arguments: { connectionId: assigned.id },
      })
    ).isError,
  ).not.toBe(true);
  expect(
    (
      await client.callTool({
        name: "test_connection",
        arguments: { connectionId: other.id },
      })
    ).isError,
  ).toBe(true);
  const result = await client.callTool({
    name: "query_data",
    arguments: {
      connectionId: assigned.id,
      query: "SELECT COUNT(*) AS total FROM events",
    },
  });
  expect(result.isError).not.toBe(true);
  expect(JSON.stringify(result)).toContain("total");
  for (const connectionId of [other.id, foreign.id])
    expect(
      (
        await client.callTool({
          name: "query_data",
          arguments: { connectionId, query: "SELECT 1" },
        })
      ).isError,
    ).toBe(true);
  expect(
    (
      await client.callTool({
        name: "query_data",
        arguments: { connectionId: assigned.id, query: "DELETE FROM events" },
      })
    ).isError,
  ).toBe(true);
  clinic.workflows.cancel(project, flow.id);
  await waitRun(clinic.store, flow.runId!);
});
