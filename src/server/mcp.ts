import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { readdir } from "node:fs/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Evidence } from "../shared/types.js";
import { Runs } from "./runs.js";
import {
  assert,
  errorText,
  id,
  now,
  readOptional,
  redact,
  safePath,
} from "./util.js";

export async function handleMcp(
  runs: Runs,
  runId: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const active = runs.active.get(runId);
  assert(
    active && request.headers.authorization === `Bearer ${active.token}`,
    "Invalid or expired run tool session.",
    401,
  );
  const run = runs.get(runId);
  const project = run.projectId ? runs.projects.get(run.projectId) : undefined;
  const agent =
    project && run.agentId
      ? (await runs.projects.agents(project)).find((a) => a.id === run.agentId)
      : undefined;
  const allowed = agent?.tools ?? ["read"];
  const server = new McpServer({ name: "clinic", version: "0.1.0" });
  const output = (data: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  });
  server.registerTool(
    "approve",
    {
      description: "Ask the user to approve a provider tool action.",
      inputSchema: {
        tool_name: z.string().optional(),
        toolName: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async (args) => {
      const name = args.tool_name ?? args.toolName ?? "tool";
      if (
        (/^(Write|Edit|NotebookEdit)$/i.test(name) &&
          (run.kind !== "developer" || !allowed.includes("edit"))) ||
        (name === "Bash" &&
          (run.kind !== "developer" || !allowed.includes("command")))
      )
        return output({
          behavior: "deny",
          message: "This agent is limited to read-only tools.",
        });
      const decision = await runs.approval(
        runId,
        `Allow ${name}?`,
        args.input ?? {},
      );
      return output(
        decision.approved
          ? { behavior: "allow", updatedInput: args.input ?? {} }
          : { behavior: "deny", message: "The user declined this action." },
      );
    },
  );
  server.registerTool(
    "ask_user",
    {
      description: "Ask for information needed to complete this run.",
      inputSchema: { question: z.string() },
    },
    async ({ question }) => {
      const response = await runs.approval(runId, question, {}, "question");
      return output({
        answer: response.answer ?? "",
        cancelled: !response.approved,
      });
    },
  );
  if (project && allowed.includes("read") && run.kind !== "po") {
    const root = run.workspace ?? project.path;
    server.registerTool(
      "list_files",
      {
        description:
          "List a directory inside this run's project workspace. Use this to explore source without executing shell commands.",
        inputSchema: { path: z.string().default(".") },
      },
      async ({ path }) => {
        const entries = await readdir(
          path === "." ? root : await safePath(root, path),
          { withFileTypes: true },
        );
        return output(
          entries
            .filter(
              (e) =>
                !e.isSymbolicLink() &&
                ![".git", "node_modules", ".env"].includes(e.name),
            )
            .slice(0, 500)
            .map((e) => ({ name: e.name, directory: e.isDirectory() })),
        );
      },
    );
    server.registerTool(
      "read_file",
      {
        description:
          "Read a bounded, redacted text file inside this run's project workspace.",
        inputSchema: {
          path: z.string(),
          offset: z.number().int().min(0).default(0),
        },
      },
      async ({ path, offset }) => {
        assert(
          !path
            .split("/")
            .some(
              (part) =>
                part === ".git" ||
                part.startsWith(".env") ||
                /\.(pem|key)$/i.test(part),
            ),
          "Credential and Git internal files are unavailable.",
        );
        const content = await readOptional(await safePath(root, path));
        assert(content !== null, "File not found.", 404);
        return output({
          path,
          content: redact(content.slice(offset, offset + 64000)),
          nextOffset: content.length > offset + 64000 ? offset + 64000 : null,
        });
      },
    );
  }
  if (project && agent && allowed.includes("data")) {
    const authorize = (connectionId: string) =>
      runs.broker.authorize(project.id, connectionId, agent.id, agent.role);
    server.registerTool(
      "test_connection",
      {
        description:
          "Test an assigned database or SSH connection using saved credentials; does not expose them.",
        inputSchema: { connectionId: z.string() },
      },
      async ({ connectionId }) => {
        try {
          authorize(connectionId);
          return output(await runs.broker.test(project.id, connectionId));
        } catch (e) {
          return { isError: true, ...output({ error: errorText(e) }) };
        }
      },
    );
    server.registerTool(
      "list_connections",
      {
        description:
          "List saved data/server connections assigned to this agent. Credentials stay in Clinic's broker.",
        inputSchema: {},
      },
      async () =>
        output(
          runs.broker
            .forAgent(project.id, agent.id, agent.role)
            .map(({ id, name, kind, allowedPaths }) => ({
              id,
              name,
              kind,
              allowedPaths,
            })),
        ),
    );
    server.registerTool(
      "inspect_schema",
      {
        description:
          "Inspect a configured database schema. Returns evidence with an ID.",
        inputSchema: { connectionId: z.string() },
      },
      async ({ connectionId }) => {
        try {
          authorize(connectionId);
          const result = await runs.broker.inspect(run.projectId, connectionId);
          const evidence = runs.store.put<Evidence>("evidence", {
            id: id(),
            projectId: run.projectId,
            connectionId,
            source: "schema inspection",
            observedAt: now(),
            result,
            rowCount: 0,
            truncated: false,
          });
          return output(evidence);
        } catch (e) {
          return { isError: true, ...output({ error: errorText(e) }) };
        }
      },
    );
    server.registerTool(
      "query_data",
      {
        description:
          "Run bounded read-only analytics on a configured connection. Returns timestamped evidence.",
        inputSchema: {
          connectionId: z.string(),
          query: z.string(),
          period: z.string().optional(),
        },
      },
      async ({ connectionId, query, period }) => {
        try {
          authorize(connectionId);
          return output(
            await runs.broker.query(run.projectId, connectionId, query, period),
          );
        } catch (e) {
          return { isError: true, ...output({ error: errorText(e) }) };
        }
      },
    );
    server.registerTool(
      "read_server_file",
      {
        description:
          "Read a bounded redacted file from a permitted server path. Returns evidence with an ID.",
        inputSchema: { connectionId: z.string(), path: z.string() },
      },
      async ({ connectionId, path }) => {
        try {
          authorize(connectionId);
          return output(
            await runs.broker.read(run.projectId, connectionId, path),
          );
        } catch (e) {
          return { isError: true, ...output({ error: errorText(e) }) };
        }
      },
    );
  }
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  reply.hijack();
  reply.raw.once("close", () => {
    void transport.close();
    void server.close();
  });
  await transport.handleRequest(request.raw, reply.raw, request.body);
}
