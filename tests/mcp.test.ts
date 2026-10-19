import { afterEach, expect, it } from "vitest";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/data.js";
import type { Approval } from "../src/shared/types.js";
import { fixtureEngine, fixtureRepo, tempDir } from "./helpers.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

it("serves scoped MCP read tools and resolves permission requests through the browser approval queue", async () => {
  const root = await tempDir();
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await fixtureRepo(repo);
  await writeFile(join(repo, ".env"), "PASSWORD=private");
  const clinic = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
  });
  cleanups.push(() => clinic.app.close());
  const address = await clinic.app.listen({ port: 0, host: "127.0.0.1" });
  clinic.runs.baseUrl = address;
  const executable = await fixtureEngine(root);
  clinic.store.put("engine", {
    id: "codex",
    path: executable,
    connected: true,
  });
  const project = await clinic.projects.add(repo, "codex");
  const { run } = await clinic.runs.chat(project, { path: "", prompt: "HANG" });
  const token = clinic.runs.active.get(run.id)!.token;
  const client = new Client({ name: "clinic-test", version: "1.0.0" });
  cleanups.push(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${address}/mcp/${run.id}`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
  const tools = await client.listTools();
  expect(tools.tools.map((t) => t.name)).toContain("read_file");
  expect(tools.tools.map((t) => t.name)).not.toContain("query_data");
  const file = await client.callTool({
    name: "read_file",
    arguments: { path: "math.ts" },
  });
  expect(JSON.stringify(file)).toContain("a - b");
  const denied = await client.callTool({
    name: "read_file",
    arguments: { path: ".env" },
  });
  expect(denied.isError).toBe(true);
  expect(JSON.stringify(denied)).not.toContain("PASSWORD=private");
  const escaped = await client.callTool({
    name: "read_file",
    arguments: { path: "../fixture-engine.cjs" },
  });
  expect(escaped.isError).toBe(true);
  const forbidden = await client.callTool({
    name: "approve",
    arguments: { tool_name: "Write", input: { file_path: "math.ts" } },
  });
  expect(JSON.stringify(forbidden)).toContain("deny");
  const pending = client.callTool({
    name: "approve",
    arguments: { tool_name: "Read", input: { file_path: "math.ts" } },
  });
  let approval: Approval | undefined;
  for (let i = 0; i < 100 && !approval; i++) {
    await new Promise((r) => setTimeout(r, 10));
    approval = clinic.store
      .list<Approval>("approval")
      .find((a) => a.status === "pending");
  }
  expect(approval).toBeDefined();
  clinic.runs.answer(run.id, approval!.id, true);
  expect(JSON.stringify(await pending)).toContain("allow");
  clinic.runs.cancel(run.id);
  const expired = await fetch(`${address}/mcp/missing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(expired.status).toBe(401);
});
