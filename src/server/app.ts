import { SetupDrafts } from "./setup-drafts.js";
import { EngineAuth } from "./engine-auth.js";
import { Workflows } from "./workflows.js";
import { AgentSchedules } from "./agent-schedules.js";
import { projectSkills } from "./skills.js";
import { parseConnectionInput } from "./connection-input.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  connectionSchema,
  engineKind,
  metricSchema,
  type Approval,
  type ConnectionProfile,
  type Conversation,
  type EngineAdapter,
  type EngineConfig,
  type EngineKind,
  type Evidence,
  type Finding,
  type MetricMapping,
  type Project,
  type Proposal,
  type Run,
  type RunEvent,
  type Schedule,
} from "../shared/types.js";
import { Store } from "./store.js";
import { Projects } from "./projects.js";
import { SpecRepository } from "./specs.js";
import { adapters, discoverEngines } from "./engines.js";
import { ConnectionBroker, SecretVault } from "./data.js";
import { Runs } from "./runs.js";
import { handleMcp } from "./mcp.js";
import {
  AppError,
  assert,
  errorText,
  hash,
  id,
  now,
  safeName,
  safePath,
  readOptional,
  slug,
} from "./util.js";

export interface AppOptions {
  dataDir: string;
  dev?: boolean;
  providers?: Record<EngineKind, EngineAdapter>;
  vault?: SecretVault;
  discover?: boolean;
  logger?: boolean;
}
export async function createApp(options: AppOptions) {
  await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
  const store = new Store(join(options.dataDir, "clinic.sqlite"));
  store.recover();
  const projects = new Projects(store),
    specs = new SpecRepository(store),
    broker = new ConnectionBroker(
      store,
      options.vault ?? new SecretVault(true, join(options.dataDir, "vault")),
    );
  const providers = options.providers ?? adapters;
  const runs = new Runs(
    store,
    projects,
    specs,
    broker,
    options.dataDir,
    providers,
  );
  const engineAuth = new EngineAuth(store, providers);
  const workflows = new Workflows(runs);
  const agentSchedules = new AgentSchedules(workflows);
  if (options.discover !== false)
    for (const engine of await discoverEngines())
      if (!store.get("engine", engine.id)) store.put("engine", engine);
  const bootstrapToken = randomBytes(32).toString("hex"),
    sessionToken = randomBytes(32).toString("hex");
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 2_000_000,
  });
  const streams = new Set<import("node:http").ServerResponse>();
  await app.register(cookie);
  const sameSecret = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  app.addHook("onRequest", async (request, reply) => {
    const host = new URL(`http://${request.headers.host ?? "localhost"}`)
      .hostname;
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(host),
      "Host is not permitted.",
      403,
    );
    const origin = request.headers.origin;
    if (origin) {
      let parsed: URL;
      try {
        parsed = new URL(origin);
      } catch {
        throw new AppError("Invalid origin.", 403);
      }
      assert(
        parsed.host === request.headers.host && parsed.protocol === "http:",
        "Foreign origins are not permitted.",
        403,
      );
    }
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Frame-Options", "DENY");
    if (
      request.url.startsWith("/api/") &&
      !request.url.startsWith("/api/session")
    )
      assert(
        sameSecret(request.cookies.clinic_session ?? "", sessionToken),
        "Open the launch URL from your terminal to connect this browser.",
        401,
      );
  });
  app.setErrorHandler((error, request, reply) => {
    const e = error as Error & { statusCode?: number };
    const code = error instanceof z.ZodError ? 400 : (e.statusCode ?? 500);
    reply.code(code).send({
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : errorText(error),
    });
  });
  app.post("/api/session", async (request, reply) => {
    const body = z.object({ token: z.string() }).parse(request.body);
    assert(
      sameSecret(body.token, bootstrapToken),
      "Invalid launch token. Use the URL printed by sdd-clinic start.",
      401,
    );
    reply.setCookie("clinic_session", sessionToken, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    });
    return { connected: true };
  });
  const setupDrafts = new SetupDrafts(runs);
  app.get("/api/setup-drafts", async () => setupDrafts.list());
  app.post("/api/setup-drafts", async (request) =>
    setupDrafts.create(request.body),
  );
  type DraftParams = { Params: { draftId: string; attachmentId: string } };
  app.get<DraftParams>("/api/setup-drafts/:draftId", async (request) => {
    const draft = setupDrafts.get(request.params.draftId);
    return {
      ...draft,
      proposal: draft.proposalId
        ? store.get("proposal", draft.proposalId)
        : undefined,
      clarification: draft.clarificationId
        ? store.get("clarification", draft.clarificationId)
        : undefined,
    };
  });
  app.put<DraftParams>("/api/setup-drafts/:draftId", async (request) =>
    setupDrafts.update(
      request.params.draftId,
      z.object({ prompt: z.string() }).parse(request.body).prompt,
    ),
  );
  app.post<DraftParams>(
    "/api/setup-drafts/:draftId/attachments",
    { bodyLimit: 14_100_000 },
    async (request) => {
      const b = z
        .object({ name: z.string().max(255), base64: z.string() })
        .parse(request.body);
      return setupDrafts.upload(request.params.draftId, b.name, b.base64);
    },
  );
  app.delete<DraftParams>(
    "/api/setup-drafts/:draftId/attachments/:attachmentId",
    async (request) =>
      setupDrafts.remove(request.params.draftId, request.params.attachmentId),
  );
  app.get<DraftParams>(
    "/api/setup-drafts/:draftId/attachments/:attachmentId",
    async (request, reply) => {
      const { attachment, bytes } = await setupDrafts.bytes(
        request.params.draftId,
        request.params.attachmentId,
      );
      return reply
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Disposition", `inline; filename="${attachment.name}"`)
        .type(attachment.mime)
        .send(bytes);
    },
  );
  app.post<DraftParams>(
    "/api/setup-drafts/:draftId/generate",
    async (request) =>
      setupDrafts.generate(
        request.params.draftId,
        (request.body as any)?.questionId
          ? z
              .object({ questionId: z.string(), answer: z.string() })
              .parse(request.body)
          : undefined,
      ),
  );
  app.post<DraftParams>("/api/setup-drafts/:draftId/cancel", async (request) =>
    setupDrafts.cancel(request.params.draftId),
  );
  app.post<DraftParams>("/api/setup-drafts/:draftId/apply", async (request) =>
    setupDrafts.apply(request.params.draftId),
  );
  app.get("/api/state", async () => ({
    projects: await Promise.all(
      store
        .list<Project>("project")
        .filter((p) => !p.setupDraft)
        .map(async (project) => {
          try {
            const files = await specs.list(project);
            const skills = await projectSkills(project);
            const agents = await projects.agents(project);
            const configured = !!(await readOptional(
              await safePath(project.path, ".clinic/project.yaml"),
            ));
            const hasOpenSpec = !!(await readOptional(
              await safePath(project.path, "openspec/config.yaml"),
            ));
            const installedAgents = await Promise.all(
              agents.map(
                async (agent) =>
                  !!(await readOptional(
                    await safePath(
                      project.path,
                      `.clinic/agents/${agent.id}.yaml`,
                    ),
                  )),
              ),
            );
            return {
              ...project,
              setupStatus:
                configured &&
                hasOpenSpec &&
                skills.some((s) => s.name === "analyze-request") &&
                skills.some((s) => s.name === "create-spec") &&
                skills.some((s) => s.name === "refine-spec") &&
                skills.some((s) => s.name === "implement-spec") &&
                installedAgents.filter(Boolean).length >= 3
                  ? "Set up"
                  : "Setup needed",
              specCount: files.filter(
                (f) => f.kind === "spec" && f.path.endsWith("/spec.md"),
              ).length,
              agentCount: installedAgents.filter(Boolean).length,
              skillCount: skills.length,
            };
          } catch (error) {
            return {
              ...project,
              setupStatus: "Unavailable",
              setupError: errorText(error),
            };
          }
        }),
    ),
    engines: store
      .list<EngineConfig>("engine")
      .map((engine) => ({ ...engine, login: engineAuth.status(engine.id) })),
    runtime: process.env.CLINIC_CONTAINER === "1" ? "docker" : "local",
    version: "0.1.0",
  }));
  app.post<{ Params: { kind: string } }>(
    "/api/engines/:kind/connect",
    async (request) => {
      const kind = engineKind.parse(request.params.kind);
      const input = z.object({ path: z.string().min(1) }).parse(request.body);
      return engineAuth.connect(kind, input.path);
    },
  );
  app.get<{ Params: { kind: string } }>(
    "/api/engines/:kind/login",
    async (request) => engineAuth.status(engineKind.parse(request.params.kind)),
  );
  app.post<{ Params: { kind: string } }>(
    "/api/engines/:kind/login",
    async (request) => {
      const input = z.object({ path: z.string().min(1) }).parse(request.body);
      return engineAuth.start(
        engineKind.parse(request.params.kind),
        input.path,
      );
    },
  );
  app.post<{ Params: { kind: string } }>(
    "/api/engines/:kind/login/cancel",
    async (request) => engineAuth.cancel(engineKind.parse(request.params.kind)),
  );
  app.post<{ Params: { kind: string } }>(
    "/api/engines/:kind/test",
    async (request) => runs.testEngine(engineKind.parse(request.params.kind)),
  );
  app.post("/api/projects", async (request) => {
    const input = z
      .object({
        path: z.string().min(1),
        name: z.string().optional(),
        engine: engineKind,
      })
      .parse(request.body);
    return projects.add(input.path, input.engine, input.name);
  });
  type P = { Params: { projectId: string } };
  app.get<P>("/api/projects/:projectId", async (request) => {
    const project = projects.get(request.params.projectId);
    const [config, agents, files, changes] = await Promise.all([
      projects.config(project),
      projects.agents(project),
      specs.list(project),
      specs.changes(project),
    ]);
    for (const change of changes)
      if (
        change.approvedHash &&
        !["done", "ready-to-integrate"].includes(change.state)
      )
        Object.assign(
          change,
          await specs.refreshApproval(project, change.name),
        );
    return {
      project,
      config,
      agents,
      skills: await projectSkills(project),
      workflows: workflows.list(project),
      agentSchedules: await agentSchedules.list(project),
      implementation: await Promise.all(
        changes.map(async (change) => {
          let verified = false;
          if (change.worktree) {
            try {
              verified = (await runs.review(project, change.name)).qaCurrent;
            } catch {}
          }
          return {
            name: change.name,
            status: verified
              ? "Implemented · verified"
              : change.codeRevision
                ? "Implemented · unverified"
                : "Not implemented",
            specHash: change.approvedHash,
            codeRevision: change.codeRevision,
          };
        }),
      ),
      files,
      changes,
      proposals: store.list<Proposal>("proposal", project.id),
      runs: store.list<Run>("run", project.id).slice(0, 100),
      findings: store.list<Finding>("finding", project.id),
      connections: store.list<ConnectionProfile>("connection", project.id),
      metrics: store.list<MetricMapping>("metric", project.id),
      schedule: store.get<Schedule>("schedule", project.id) ?? {
        id: project.id,
        projectId: project.id,
        enabled: false,
        intervalHours: 24,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
      },
      conversations: store.list<Conversation>("conversation", project.id),
    };
  });
  app.get<P>("/api/projects/:projectId/inspect", async (request) =>
    projects.inspect(projects.get(request.params.projectId)),
  );
  app.post<P>("/api/projects/:projectId/setup", async (request) => {
    const project = projects.get(request.params.projectId);
    const { mode } = z
      .object({ mode: z.enum(["auto", "files", "analyze"]).default("auto") })
      .parse(request.body ?? {});
    const config = await projects.config(project);
    const connected = store.get<EngineConfig>(
      "engine",
      config.engine,
    )?.connected;
    if (mode === "analyze" || (mode === "auto" && connected))
      return { run: await runs.setupAnalysis(project), proposal: null };
    const setup = await projects.setupFiles(project);
    return {
      analysisMessage:
        mode === "files"
          ? "Files-only setup: code-derived specifications were not generated. Run project analysis with a connected CLI to create them."
          : `Connect ${config.engine} CLI and run Set up SDD to analyze the project and generate specifications. This proposal installs guidance files only.`,
      inspection: setup.inspection,
      proposal: setup.files.length
        ? await specs.propose(
            project,
            "Set up spec-driven development",
            setup.files,
            "setup",
          )
        : null,
    };
  });
  app.put<P>("/api/projects/:projectId/config", async (request) =>
    projects.saveConfig(projects.get(request.params.projectId), request.body),
  );
  app.post<P>("/api/projects/:projectId/agents", async (request) =>
    projects.saveAgent(projects.get(request.params.projectId), request.body),
  );
  app.post<P>("/api/projects/:projectId/changes", async (request) => {
    const input = z
      .object({
        name: z.string(),
        title: z.string(),
        description: z.string(),
        capability: z.string().optional(),
      })
      .parse(request.body);
    const project = projects.get(request.params.projectId);
    const proposal = await specs.createChange(
      project,
      input.name,
      input.title,
      input.description,
      input.capability,
    );
    return { ...specs.change(project, input.name), proposal };
  });
  app.post<P>("/api/projects/:projectId/edit", async (request) => {
    const input = z
      .object({ path: z.string(), content: z.string(), baseHash: z.string() })
      .parse(request.body);
    const project = projects.get(request.params.projectId);
    const file = await specs.file(project, input.path);
    assert(
      file.hash === input.baseHash,
      "File changed outside Clinic. Reload before editing.",
      409,
    );
    if (input.path.startsWith("openspec/project/"))
      return specs.propose(
        project,
        `Edit ${input.path.split("/").at(-1)}`,
        [
          {
            path: input.path,
            after: input.content,
            beforeHash: input.baseHash,
          },
        ],
        "manual",
      );
    if (input.path.startsWith("openspec/specs/")) {
      if (/\/(design|validation)\.md$/.test(input.path))
        return specs.propose(
          project,
          `Edit ${input.path.split("/").at(-1)}`,
          [
            {
              path: input.path,
              after: input.content,
              beforeHash: input.baseHash,
            },
          ],
          "manual",
        );
      assert(
        input.path.endsWith("/spec.md"),
        "Supporting capability documents are maintained in the repository. Prompt a new change to revise the design or validation plan.",
      );
      const capability = input.path
        .slice("openspec/specs/".length)
        .replace(/\/spec.md$/, "");
      const change = `edit-${slug(capability)}-${id().slice(0, 6)}`;
      const start = input.content.indexOf("### Requirement:");
      assert(
        start >= 0,
        "A specification must include at least one Requirement and Scenario.",
      );
      return specs.propose(
        project,
        `Revise ${capability}`,
        [
          {
            path: `openspec/changes/${change}/specs/${capability}/spec.md`,
            after: `## MODIFIED Requirements\n\n${input.content.slice(start)}`,
          },
          {
            path: `openspec/changes/${change}/proposal.md`,
            after: `# Revise ${capability}\n\n## Why\nUpdate the accepted behavior based on the reviewed specification edit.\n\n## What Changes\n- Revise ${capability}.\n\n## Capabilities\n### New Capabilities\nNone.\n### Modified Capabilities\n- \`${capability}\`: revised behavior.\n\n## Impact\nReview design and implementation impact before approval.\n`,
          },
        ],
        "manual",
        change,
        [{ path: file.path, hash: file.hash }],
      );
    }
    const change = input.path.split("/")[2]!;
    assert(
      change !== "archive",
      "Archived changes are immutable. Create a new change.",
    );
    return specs.propose(
      project,
      `Edit ${input.path.split("/").at(-1)}`,
      [{ path: input.path, after: input.content, beforeHash: input.baseHash }],
      "manual",
      change,
    );
  });
  app.post<P>("/api/projects/:projectId/workflows", async (request) => {
    const input = z
      .object({
        prompt: z.string().trim().min(1).max(30000),
        agentId: z.string().default("developer"),
        previousWorkflowId: z.string().optional(),
      })
      .parse(request.body);
    return workflows.start(
      projects.get(request.params.projectId),
      input.prompt,
      input.agentId,
      input.previousWorkflowId,
    );
  });
  type WorkflowParams = { Params: { projectId: string; id: string } };
  app.post<WorkflowParams>(
    "/api/projects/:projectId/workflows/:id/continue",
    async (request) => {
      const input = z
        .object({
          answer: z.string().max(30000).optional(),
          questionId: z.string().optional(),
        })
        .refine(
          (value) => !value.answer || !!value.questionId,
          "Include the current question ID with the answer.",
        )
        .parse(request.body ?? {});
      return workflows.continue(
        projects.get(request.params.projectId),
        request.params.id,
        input.answer,
        input.questionId,
      );
    },
  );
  app.post<WorkflowParams>(
    "/api/projects/:projectId/workflows/:id/cancel",
    async (request) =>
      workflows.cancel(
        projects.get(request.params.projectId),
        request.params.id,
      ),
  );
  app.put<WorkflowParams>(
    "/api/projects/:projectId/agent-schedules/:id",
    async (request) =>
      agentSchedules.save(
        projects.get(request.params.projectId),
        request.params.id,
        request.body,
      ),
  );
  app.post<P>("/api/projects/:projectId/chat", async (request) => {
    const input = z
      .object({
        prompt: z.string().min(1).max(30000),
        path: z.string().default(""),
        conversationId: z.string().optional(),
        engine: engineKind.optional(),
        change: z.string().optional(),
      })
      .parse(request.body);
    return runs.chat(projects.get(request.params.projectId), input);
  });
  type PC = { Params: { projectId: string; name: string } };
  app.post<PC>(
    "/api/projects/:projectId/changes/:name/validate",
    async (request) =>
      specs.validate(
        projects.get(request.params.projectId),
        request.params.name,
      ),
  );
  app.post<PC>(
    "/api/projects/:projectId/changes/:name/approve",
    async (request) =>
      specs.approve(
        projects.get(request.params.projectId),
        request.params.name,
      ),
  );
  app.post<PC>(
    "/api/projects/:projectId/changes/:name/develop",
    async (request) => {
      const input = z
        .object({
          agentId: z.string().default("developer"),
          baseline: z.string().min(1).max(200).optional(),
        })
        .parse(request.body ?? {});
      return runs.develop(
        projects.get(request.params.projectId),
        request.params.name,
        input.agentId,
        input.baseline,
      );
    },
  );
  app.post<{ Params: { projectId: string; agentId: string } }>(
    "/api/projects/:projectId/agents/:agentId/run",
    async (request) => {
      const { prompt } = z
        .object({ prompt: z.string().min(1).max(20000) })
        .parse(request.body);
      return runs.runCustom(
        projects.get(request.params.projectId),
        request.params.agentId,
        prompt,
      );
    },
  );
  app.post<PC>("/api/projects/:projectId/changes/:name/qa", async (request) =>
    runs.retryQa(projects.get(request.params.projectId), request.params.name),
  );
  app.get<PC>(
    "/api/projects/:projectId/changes/:name/review",
    async (request) =>
      runs.review(projects.get(request.params.projectId), request.params.name),
  );
  app.post<PC>(
    "/api/projects/:projectId/changes/:name/finalize",
    async (request) =>
      runs.finalize(
        projects.get(request.params.projectId),
        request.params.name,
      ),
  );
  app.post<PC>(
    "/api/projects/:projectId/changes/:name/integration",
    async (request) =>
      runs.verifyIntegration(
        projects.get(request.params.projectId),
        request.params.name,
      ),
  );
  type PI = { Params: { projectId: string; id: string } };
  app.post<PI>(
    "/api/projects/:projectId/proposals/:id/apply",
    async (request) =>
      specs.apply(projects.get(request.params.projectId), request.params.id),
  );
  app.post<PI>(
    "/api/projects/:projectId/proposals/:id/reject",
    async (request) => {
      const proposal = store.require<Proposal>(
        "proposal",
        request.params.id,
        request.params.projectId,
      );
      assert(proposal.status === "pending", "Proposal already resolved.");
      return store.put("proposal", { ...proposal, status: "rejected" });
    },
  );
  app.get("/api/runs", async () => store.list<Run>("run").slice(0, 200));
  app.get<{ Params: { id: string } }>("/api/runs/:id", async (request) => ({
    run: runs.get(request.params.id),
    events: store.replay(request.params.id),
    approvals: store
      .list<Approval>("approval")
      .filter((a) => a.runId === request.params.id),
  }));
  app.post<{ Params: { id: string } }>(
    "/api/runs/:id/cancel",
    async (request) => runs.cancel(request.params.id),
  );
  app.post<{ Params: { id: string; approvalId: string } }>(
    "/api/runs/:id/approvals/:approvalId",
    async (request) => {
      const body = z
        .object({ approved: z.boolean(), answer: z.string().optional() })
        .parse(request.body);
      runs.answer(
        request.params.id,
        request.params.approvalId,
        body.approved,
        body.answer,
      );
      return { resolved: true };
    },
  );
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>(
    "/api/runs/:id/events",
    async (request, reply) => {
      runs.get(request.params.id);
      let cursor = Number(
        request.headers["last-event-id"] ?? request.query.after ?? 0,
      );
      assert(
        Number.isSafeInteger(cursor) && cursor >= 0,
        "Invalid event cursor.",
      );
      reply.hijack();
      streams.add(reply.raw);
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const send = (event: RunEvent) => {
        if (event.id <= cursor) return;
        cursor = event.id;
        reply.raw.write(
          `id: ${event.id}\nevent: clinic\ndata: ${JSON.stringify(event)}\n\n`,
        );
      };
      store.events.on(request.params.id, send);
      let chunk;
      do {
        chunk = store.replay(request.params.id, cursor);
        for (const event of chunk) send(event);
      } while (chunk.length === 10000);
      const heartbeat = setInterval(
        () => reply.raw.write(": heartbeat\n\n"),
        15000,
      );
      request.raw.on("close", () => {
        streams.delete(reply.raw);
        clearInterval(heartbeat);
        store.events.off(request.params.id, send);
      });
    },
  );
  app.post<P>("/api/projects/:projectId/connection-prompt", async (request) => {
    const project = projects.get(request.params.projectId);
    const { prompt, agentId, connectionId } = z
      .object({
        prompt: z.string().min(1).max(64000),
        agentId: z.string(),
        connectionId: z.string().optional(),
      })
      .parse(request.body);
    const agent = (await projects.agents(project)).find(
      (a) => a.id === agentId,
    );
    assert(agent, "Choose an agent from this project.", 404);
    const previous = connectionId
      ? store.require<ConnectionProfile>("connection", connectionId, project.id)
      : undefined;
    const { profile, secret } = parseConnectionInput(prompt, previous);
    const match =
      previous ??
      store
        .list<ConnectionProfile>("connection", project.id)
        .find((p) =>
          [
            "kind",
            "host",
            "port",
            "username",
            "database",
            "path",
            "sshConnectionId",
          ].every((k) => (p as any)[k] === (profile as any)[k]),
        );
    const saved = await broker.save(
      project.id,
      {
        ...profile,
        agentIds: [
          ...new Set([
            ...(match?.agentIds ??
              (match
                ? (await projects.agents(project))
                    .filter((a) => a.role === "po")
                    .map((a) => a.id)
                : [])),
            agentId,
          ]),
        ],
      },
      secret,
      match?.id,
    );
    if (!agent.tools.includes("data"))
      await projects.saveAgent(project, {
        ...agent,
        tools: [...agent.tools, "data"],
      });
    return {
      connection: saved,
      message: `Saved ${saved.name} for ${agent.name}. Connection has not been tested.`,
    };
  });
  app.post<P>("/api/projects/:projectId/connections", async (request) => {
    projects.get(request.params.projectId);
    const input = z
      .object({
        profile: connectionSchema,
        secret: z
          .object({
            password: z.string().optional(),
            privateKey: z.string().optional(),
            passphrase: z.string().optional(),
          })
          .default({}),
        id: z.string().optional(),
      })
      .parse(request.body);
    if (input.profile.agentIds) {
      const agents = await projects.agents(
        projects.get(request.params.projectId),
      );
      assert(
        input.profile.agentIds.every((id) => agents.some((a) => a.id === id)),
        "Choose agents from this project.",
        404,
      );
    }
    return broker.save(
      request.params.projectId,
      input.profile,
      input.secret,
      input.id,
    );
  });
  app.post<PI>(
    "/api/projects/:projectId/connections/:id/test",
    async (request) => broker.test(request.params.projectId, request.params.id),
  );
  app.get<PI>(
    "/api/projects/:projectId/connections/:id/schema",
    async (request) =>
      broker.inspect(request.params.projectId, request.params.id),
  );
  app.post<PI>(
    "/api/projects/:projectId/connections/:id/query",
    async (request) => {
      const body = z
        .object({ query: z.string(), period: z.string().optional() })
        .parse(request.body);
      return broker.query(
        request.params.projectId,
        request.params.id,
        body.query,
        body.period,
      );
    },
  );
  app.post<PI>(
    "/api/projects/:projectId/connections/:id/read",
    async (request) => {
      const body = z.object({ path: z.string() }).parse(request.body);
      return broker.read(
        request.params.projectId,
        request.params.id,
        body.path,
      );
    },
  );
  app.delete<PI>(
    "/api/projects/:projectId/connections/:id",
    async (request) => {
      store.require<ConnectionProfile>(
        "connection",
        request.params.id,
        request.params.projectId,
      );
      assert(
        !store
          .list<ConnectionProfile>("connection", request.params.projectId)
          .some((p) => p.sshConnectionId === request.params.id),
        "This SSH profile is used by a database tunnel.",
      );
      assert(
        !store
          .list<MetricMapping>("metric", request.params.projectId)
          .some((m) => m.connectionId === request.params.id),
        "Remove metric mappings that use this connection first.",
      );
      await broker.vault.delete(request.params.id);
      store.delete("connection", request.params.id);
      return { deleted: true };
    },
  );
  app.post<P>("/api/projects/:projectId/metrics", async (request) => {
    const input = metricSchema
      .extend({ id: z.string().optional() })
      .parse(request.body);
    store.require<ConnectionProfile>(
      "connection",
      input.connectionId,
      request.params.projectId,
    );
    if (input.id)
      store.require<MetricMapping>(
        "metric",
        input.id,
        request.params.projectId,
      );
    return store.put<MetricMapping>("metric", {
      ...input,
      id: input.id ?? id(),
      projectId: request.params.projectId,
    });
  });
  app.delete<PI>("/api/projects/:projectId/metrics/:id", async (request) => {
    store.require<MetricMapping>(
      "metric",
      request.params.id,
      request.params.projectId,
    );
    store.delete("metric", request.params.id);
    return { deleted: true };
  });
  app.post<P>("/api/projects/:projectId/analyze", async (request) => {
    const input = z
      .object({
        agentId: z.string().default("po"),
        suggestMappings: z.boolean().default(false),
      })
      .parse(request.body ?? {});
    return runs.analyze(
      projects.get(request.params.projectId),
      input.agentId,
      input.suggestMappings,
    );
  });
  app.put<P>("/api/projects/:projectId/schedule", async (request) => {
    projects.get(request.params.projectId);
    const input = z
      .object({
        enabled: z.boolean(),
        intervalHours: z.number().min(1).max(8760),
      })
      .parse(request.body);
    if (input.enabled)
      assert(
        store
          .list<MetricMapping>("metric", request.params.projectId)
          .some((m) => m.reviewed),
        "Review at least one metric mapping before scheduling PO analysis.",
      );
    return store.put<Schedule>("schedule", {
      id: request.params.projectId,
      projectId: request.params.projectId,
      ...input,
      nextRunAt: new Date(
        Date.now() + input.intervalHours * 3600000,
      ).toISOString(),
    });
  });
  app.patch<PI>("/api/projects/:projectId/findings/:id", async (request) => {
    const input = z
      .object({
        status: z.enum(["triage", "ready", "dismissed", "resolved"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
      })
      .parse(request.body);
    const finding = store.require<Finding>(
      "finding",
      request.params.id,
      request.params.projectId,
    );
    return store.put("finding", { ...finding, ...input, updatedAt: now() });
  });
  app.post<PI>(
    "/api/projects/:projectId/findings/:id/convert",
    async (request) =>
      runs.convertFinding(
        projects.get(request.params.projectId),
        request.params.id,
      ),
  );
  app.get<PI>("/api/projects/:projectId/evidence/:id", async (request) =>
    store.require<Evidence>(
      "evidence",
      request.params.id,
      request.params.projectId,
    ),
  );
  app.post<{ Params: { id: string } }>("/mcp/:id", async (request, reply) =>
    handleMcp(runs, request.params.id, request, reply),
  );
  const root = fileURLToPath(new URL("../../", import.meta.url));
  let vite: import("vite").ViteDevServer | undefined;
  if (options.dev) {
    const { createServer } = await import("vite");
    vite = await createServer({
      root,
      server: { middlewareMode: true, hmr: { server: app.server } },
      appType: "custom",
    });
  } else
    await app.register(staticFiles, {
      root: join(root, "dist/web"),
      wildcard: false,
    });
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/") || request.url.startsWith("/mcp/"))
      return reply.code(404).send({ error: "Route not found." });
    if (vite) {
      reply.hijack();
      vite.middlewares(request.raw, reply.raw, async () => {
        try {
          const template = await readFile(join(root, "index.html"), "utf8");
          reply.raw.setHeader("Content-Type", "text/html");
          reply.raw.end(await vite!.transformIndexHtml(request.url, template));
        } catch (e) {
          reply.raw.statusCode = 500;
          reply.raw.end(errorText(e));
        }
      });
      return;
    }
    return reply.sendFile("index.html");
  });
  await runs.scheduleTick(true);
  await agentSchedules.tick(true);
  const scheduler = setInterval(() => {
    void runs.scheduleTick().catch(() => {});
    void agentSchedules.tick().catch(() => {});
  }, 30000);
  scheduler.unref();
  app.addHook("preClose", async () => {
    runs.shutdown();
    for (const stream of streams) stream.end();
  });
  app.addHook("onClose", async () => {
    clearInterval(scheduler);
    await engineAuth.close();
    runs.shutdown();
    await vite?.close();
    while (runs.active.size) await new Promise((r) => setTimeout(r, 50));
    store.close();
  });
  return {
    app,
    store,
    projects,
    specs,
    runs,
    workflows,
    agentSchedules,
    engineAuth,
    broker,
    bootstrapToken,
  };
}
