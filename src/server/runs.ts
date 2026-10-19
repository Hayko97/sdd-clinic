import {
  ask,
  answerContext,
  clarificationInstruction,
  NeedsClarification,
  requireClearIntent,
} from "./clarification.js";
import { defaultSkills, projectSkills } from "./skills.js";
import { analyzeSetup } from "./setup-analysis.js";
import { authoringInstructions, schemaSupportFiles } from "./documentation.js";
import { containsConnectionDetails } from "../shared/connection-input.js";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  agentSchema,
  findingSchema,
  metricSchema,
  type AgentDefinition,
  type Approval,
  type ChangeRecord,
  type CheckResult,
  type ConnectionProfile,
  type Conversation,
  type EngineAdapter,
  type EngineConfig,
  type EngineKind,
  type Evidence,
  type Finding,
  type MetricMapping,
  type Project,
  type QaReport,
  type Run,
  type Schedule,
} from "../shared/types.js";
import { adapters } from "./engines.js";
import { defaultAgents, Projects } from "./projects.js";
import { SpecRepository } from "./specs.js";
import { Store } from "./store.js";
import { ConnectionBroker } from "./data.js";
import {
  AppError,
  KeyLock,
  assert,
  atomicWrite,
  cleanEnv,
  command,
  errorText,
  hash,
  id,
  now,
  parseJsonOutput,
  readOptional,
  redact,
  safeName,
  safePath,
  slug,
} from "./util.js";

type ActiveRun = {
  controller: AbortController;
  token: string;
  approvalResolvers: Map<
    string,
    (answer: { approved: boolean; answer?: string }) => void
  >;
};
const filesOutput = z.object({
  summary: z.string(),
  files: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .min(1)
    .max(100),
});
const qaOutput = z.object({
  summary: z.string(),
  criteria: z.array(
    z.object({
      scenario: z.string(),
      status: z.enum(["passed", "failed", "unverified"]),
      evidence: z.string(),
    }),
  ),
});

export class Runs {
  readonly active = new Map<string, ActiveRun>();
  baseUrl = "";
  private busy = new Set<string>();
  private finalizeLocks = new KeyLock();
  constructor(
    readonly store: Store,
    readonly projects: Projects,
    readonly specs: SpecRepository,
    readonly broker: ConnectionBroker,
    readonly dataDir: string,
    readonly providers: Record<EngineKind, EngineAdapter> = adapters,
  ) {}
  get(runId: string, projectId?: string) {
    return this.store.require<Run>("run", runId, projectId);
  }
  private engine(kind: EngineKind) {
    const config = this.store.get<EngineConfig>("engine", kind);
    assert(config?.connected, `Connect ${kind} CLI before starting this run.`);
    return config;
  }
  private begin(
    run: Run,
    task: (signal: AbortSignal) => Promise<void>,
    lock?: string,
  ) {
    if (lock) {
      assert(
        !this.busy.has(lock),
        "A run is already active for this change or conversation.",
        409,
      );
      this.busy.add(lock);
    }
    const active: ActiveRun = {
      controller: new AbortController(),
      token: id() + id(),
      approvalResolvers: new Map(),
    };
    // Coordinate with the host's GUI mount update using the same SQLite write lock.
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      const maintenance = this.store.get<{ expiresAt: number }>(
        "maintenance",
        "gui-mount-update",
      );
      assert(
        !maintenance || maintenance.expiresAt < Date.now(),
        "Clinic is updating project mounts. Retry this action shortly.",
        409,
      );
      this.store.put("run", run);
      this.store.db.exec("COMMIT");
    } catch (error) {
      this.store.db.exec("ROLLBACK");
      if (lock) this.busy.delete(lock);
      throw error;
    }
    this.active.set(run.id, active);
    this.store.append(run.id, "started", { title: run.title });
    void (async () => {
      try {
        await task(active.controller.signal);
        const current = this.get(run.id);
        if (active.controller.signal.aborted)
          throw new AppError("Run interrupted.");
        this.store.put("run", {
          ...current,
          status: "completed",
          endedAt: now(),
        });
        this.store.append(run.id, "completed", { message: "Run completed." });
      } catch (e) {
        const current = this.get(run.id);
        if (
          !active.controller.signal.aborted &&
          current.clarificationId &&
          this.store.get<import("../shared/types.js").Clarification>(
            "clarification",
            current.clarificationId,
          )?.status === "pending"
        ) {
          this.store.put("run", {
            ...current,
            status: "waiting",
            error: undefined,
          });
          if (run.change)
            this.store.put("change", {
              ...this.specs.change(
                this.projects.get(run.projectId),
                run.change,
              ),
              state: "ready",
              qaRunId: undefined,
            });
          return;
        }
        const status = active.controller.signal.aborted
          ? "interrupted"
          : "failed";
        this.store.put("run", {
          ...current,
          status,
          error: errorText(e),
          endedAt: now(),
        });
        this.store.append(run.id, status, { message: errorText(e) });
        if (run.kind === "connection-test") {
          const engine = this.store.get<EngineConfig>("engine", run.engine);
          if (engine)
            this.store.put("engine", {
              ...engine,
              connected: false,
              probe: engine.probe
                ? {
                    ...engine.probe,
                    detail: `Connection test failed: ${errorText(e)}. Check provider authentication and access, then reconnect.`,
                  }
                : undefined,
            });
        }
        if (run.change && ["developer", "qa"].includes(run.kind)) {
          const project = this.projects.get(run.projectId);
          const change = this.specs.change(project, run.change);
          if (run.kind === "developer" || change.qaRunId === run.id)
            this.store.put("change", {
              ...change,
              state: change.approvedHash ? "ready" : "draft",
              qaRunId: undefined,
              updatedAt: now(),
            });
        }
      } finally {
        for (const approvalId of active.approvalResolvers.keys())
          this.answer(run.id, approvalId, false);
        this.active.delete(run.id);
        if (lock) this.busy.delete(lock);
      }
    })();
    return run;
  }
  private make(
    projectId: string,
    kind: Run["kind"],
    title: string,
    engine: EngineKind,
    extra: Partial<Run> = {},
  ): Run {
    return {
      id: id(),
      projectId,
      kind,
      title,
      engine,
      status: "running",
      startedAt: now(),
      ...extra,
    };
  }
  async approval(
    runId: string,
    title: string,
    details: unknown,
    kind: Approval["kind"] = "tool",
  ) {
    const active = this.active.get(runId);
    assert(
      active && !active.controller.signal.aborted,
      "Run is no longer active.",
      409,
    );
    const run = this.get(runId);
    const approval: Approval = {
      id: id(),
      projectId: run.projectId,
      runId,
      title,
      details: redact(details),
      kind,
      status: "pending",
    };
    this.store.put("approval", approval);
    this.store.put("run", { ...run, status: "waiting" });
    this.store.append(runId, "approval", approval);
    return new Promise<{ approved: boolean; answer?: string }>((resolve) =>
      active.approvalResolvers.set(approval.id, resolve),
    );
  }
  answer(
    runId: string,
    approvalId: string,
    approved: boolean,
    answer?: string,
  ) {
    const approval = this.store.require<Approval>("approval", approvalId);
    assert(
      approval.runId === runId,
      "Approval does not belong to this run.",
      404,
    );
    const active = this.active.get(runId);
    const resolve = active?.approvalResolvers.get(approvalId);
    assert(resolve, "This approval is no longer pending.", 409);
    active!.approvalResolvers.delete(approvalId);
    this.store.put("approval", {
      ...approval,
      status: approved ? "approved" : "denied",
      answer,
    });
    const run = this.get(runId);
    this.store.put("run", {
      ...run,
      status: active!.approvalResolvers.size ? "waiting" : "running",
    });
    this.store.append(runId, "approval-resolved", { id: approvalId, approved });
    resolve({ approved, answer });
  }
  cancel(runId: string) {
    const active = this.active.get(runId);
    const run = this.get(runId);
    const q = run.clarificationId
      ? this.store.get<import("../shared/types.js").Clarification>(
          "clarification",
          run.clarificationId,
        )
      : undefined;
    assert(active || q?.status === "pending", "Run is not active.", 409);
    if (q?.status === "pending")
      this.store.put("clarification", { ...q, status: "canceled" });
    if (!active) {
      this.store.put("run", {
        ...run,
        status: "interrupted",
        endedAt: now(),
        error: "Clarification canceled; partial work is preserved.",
      });
      return { interrupted: true };
    }
    active.controller.abort();
    for (const approvalId of [...active.approvalResolvers.keys()])
      this.answer(runId, approvalId, false);
    return { interrupted: true };
  }
  shutdown() {
    for (const runId of this.active.keys()) this.cancel(runId);
  }
  private async invoke(
    run: Run,
    cwd: string,
    prompt: string,
    agent: AgentDefinition | undefined,
    signal: AbortSignal,
    sessionId?: string,
    images?: import("../shared/types.js").EngineRequest["images"],
  ) {
    const skillName =
      run.skillName ??
      (run.kind === "chat"
        ? "create-spec"
        : run.kind === "developer"
          ? "implement-spec"
          : undefined);
    const installedSkill = skillName
      ? (await projectSkills(this.projects.get(run.projectId))).find(
          (s) => s.name === skillName,
        )
      : undefined;
    const bundledSkill =
      run.kind === "setup-analysis" && skillName
        ? defaultSkills.find((s) => s.name === skillName)
        : undefined;
    const skill =
      installedSkill ??
      (bundledSkill
        ? { ...bundledSkill, path: "bundled setup default" }
        : undefined);
    assert(
      (run.kind !== "planning" && skillName !== "refine-spec") || skill,
      `Missing ${skillName} skill. Run Set up SDD for this project.`,
    );
    if (skill) {
      this.store.append(run.id, "skill", {
        name: skill.name,
        path: skill.path,
        revision: hash(skill.content),
        content: skill.content,
      });
      prompt = `${skill.content}\n\n${prompt}`;
    }
    const engine = this.engine(run.engine);
    if (agent?.tools.includes("data")) {
      const sources = this.broker
        .forAgent(run.projectId, agent.id, agent.role)
        .map(({ id, name, kind, allowedPaths }) => ({
          id,
          name,
          kind,
          allowedPaths,
        }));
      prompt += `\nSaved sources assigned to you: ${JSON.stringify(sources)}. Use Clinic list_connections, test_connection, inspect_schema, query_data and read_server_file tools for bounded read-only access. Credentials are already stored; never request or write them into project files.`;
    }
    const active = this.active.get(run.id)!;
    const result = await this.providers[run.engine].run(engine.path, {
      cwd,
      prompt,
      images,
      sessionId,
      model: agent?.model,
      tools: agent?.tools ?? ["read"],
      instructions: agent?.instructions,
      mode:
        run.kind === "developer" && agent?.tools.includes("edit")
          ? "workspace-write"
          : "read-only",
      timeoutMs: (agent?.timeoutMinutes ?? 15) * 60000,
      maxTurns: agent?.maxTurns ?? 30,
      signal,
      mcp:
        this.baseUrl && run.kind !== "setup-analysis"
          ? { url: `${this.baseUrl}/mcp/${run.id}`, token: active.token }
          : undefined,
      onEvent: (type, data) => {
        if (type === "session") {
          const session = (data as { id: string }).id;
          this.store.put("run", { ...this.get(run.id), sessionId: session });
        }
        this.store.append(run.id, type, redact(data));
      },
      onApproval: async (title, details, kind) => {
        if (
          kind === "question" &&
          ["developer", "qa", "planning"].includes(run.kind)
        ) {
          const raw = details as {
            questions?: { question?: string; header?: string }[];
          };
          await this.pause(
            run,
            raw.questions?.map((q) => q.question ?? q.header ?? title) ?? [
              title + "\n" + JSON.stringify(details),
            ],
            run.kind,
          );
        }
        return this.approval(run.id, title, details, kind);
      },
    });
    this.store.put("run", {
      ...this.get(run.id),
      output: result.text,
      sessionId: result.sessionId,
    });
    return result;
  }
  async pause(run: Run, questions: string[], stage: string): Promise<never> {
    const project = this.projects.get(run.projectId);
    const flow = this.store
      .list<import("../shared/types.js").DeveloperWorkflow>(
        "workflow",
        run.projectId,
      )
      .find((f) => f.runId === run.id);
    const changeName = run.change ?? flow?.change;
    const change = changeName
      ? this.specs.change(project, changeName)
      : undefined;
    const specHash =
      run.specHash ??
      change?.approvedHash ??
      (changeName &&
      (await this.specs.list(project)).some((f) => f.change === changeName)
        ? (await this.specs.snapshot(project, changeName)).hash
        : undefined);
    const workspace = this.get(run.id).workspace;
    const codeRevision = workspace
      ? await this.git(workspace, ["rev-parse", "HEAD"])
      : change?.codeRevision;
    const q = ask(this.store, {
      projectId: run.projectId,
      ownerId: run.id,
      stage,
      questions,
      change: changeName,
      specHash,
      codeRevision,
    });
    this.store.put("run", {
      ...this.get(run.id),
      clarificationId: q.id,
      status: "waiting",
    });
    this.store.append(run.id, "clarification", q);
    if (
      run.change &&
      ["developer", "qa"].includes(run.kind) &&
      !this.store
        .list<import("../shared/types.js").DeveloperWorkflow>(
          "workflow",
          run.projectId,
        )
        .some(
          (f) =>
            f.change === run.change &&
            !["review", "failed", "canceled", "interrupted"].includes(f.stage),
        )
    ) {
      this.store.put("workflow", {
        id: id(),
        projectId: run.projectId,
        agentId:
          run.kind === "qa"
            ? ((await this.projects.agents(project)).find(
                (a) => a.role === "developer",
              )?.id ?? "developer")
            : (run.agentId ?? "developer"),
        prompt: `Continue ${run.change} after resolving product intent.`,
        change: run.change,
        stage: "needs-input",
        runId: run.id,
        clarificationId: q.id,
        resumeStage: stage,
        resumeWorkspace: true,
        summary: questions.join("\n\n"),
        createdAt: now(),
        updatedAt: now(),
      });
    }
    throw new NeedsClarification("Product clarification required.");
  }
  productSetup(
    project: Project,
    task: (
      invoke: (
        prompt: string,
        images?: import("../shared/types.js").EngineRequest["images"],
      ) => Promise<string>,
      signal: AbortSignal,
      run: Run,
    ) => Promise<void>,
  ) {
    this.engine(project.engine);
    const run = this.make(
      project.id,
      "setup-analysis",
      "Set up project from product sources",
      project.engine,
      { skillName: "create-spec" },
    );
    return this.begin(
      run,
      async (signal) => {
        const workspace = await mkdtemp(
          join(this.dataDir, "product-analysis-"),
        );
        try {
          await task(
            async (prompt, images) =>
              (
                await this.invoke(
                  run,
                  workspace,
                  prompt,
                  { ...defaultAgents[0]!, tools: [] },
                  signal,
                  undefined,
                  images,
                )
              ).text,
            signal,
            run,
          );
        } finally {
          await rm(workspace, { recursive: true, force: true });
        }
      },
      `setup:${project.id}`,
    );
  }
  async setupAnalysis(project: Project) {
    const config = await this.projects.config(project);
    this.engine(config.engine);
    const run = this.make(
      project.id,
      "setup-analysis",
      "Analyze existing project and generate specs",
      config.engine,
    );
    return this.begin(
      run,
      async (signal) => {
        await mkdir(join(this.dataDir, "scratch"), { recursive: true });
        const scratch = await mkdtemp(join(this.dataDir, "scratch", "setup-"));
        try {
          const proposal = await analyzeSetup({
            project,
            projects: this.projects,
            specs: this.specs,
            signal,
            invoke: async (skillName, prompt) => {
              assert(!signal.aborted, "Project analysis interrupted.");
              const response = await this.invoke(
                { ...run, skillName },
                scratch,
                prompt,
                {
                  ...defaultAgents[0]!,
                  tools: [],
                  instructions:
                    "Analyze only the supplied redacted repository evidence. No filesystem tools, shell commands or code edits are authorized. Return the requested JSON for human review.",
                },
                signal,
              );
              assert(!signal.aborted, "Project analysis interrupted.");
              return response.text;
            },
            progress: (message, details) =>
              this.store.append(run.id, "setup-progress", {
                message,
                ...details,
              }),
          });
          this.store.put("run", {
            ...this.get(run.id),
            proposalId: proposal.id,
          });
          this.store.append(run.id, "proposal", {
            id: proposal.id,
            summary: proposal.title,
          });
        } finally {
          await rm(scratch, { recursive: true, force: true });
        }
      },
      `setup:${project.id}`,
    );
  }
  async skillRun(
    project: Project,
    agent: AgentDefinition,
    skillName: NonNullable<Run["skillName"]>,
    prompt: string,
    consume: (text: string, run: Run) => Promise<void>,
  ) {
    const config = await this.projects.config(project);
    const engine = agent.engine === "project" ? config.engine : agent.engine;
    this.engine(engine);
    assert(
      (await projectSkills(project)).some((s) => s.name === skillName),
      `Missing ${skillName}. Run Set up SDD for this project.`,
    );
    const run = this.make(
      project.id,
      "planning",
      `${agent.name}: ${skillName}`,
      engine,
      { agentId: agent.id, skillName },
    );
    return this.begin(run, async (signal) => {
      const response = await this.invoke(
        run,
        project.path,
        prompt,
        {
          ...agent,
          tools: agent.tools.includes("data") ? ["read", "data"] : ["read"],
          instructions: `${agent.instructions}\nThis operation is planning only. Return the requested structured result and do not edit application code.`,
        },
        signal,
      );
      if (signal.aborted) throw new Error("Run interrupted.");
      await consume(response.text, run);
    });
  }
  testEngine(kind: EngineKind) {
    this.engine(kind);
    const run = this.make(
      "",
      "connection-test",
      `Test ${kind} connection`,
      kind,
    );
    return this.begin(run, async (signal) => {
      await mkdir(join(this.dataDir, "scratch"), { recursive: true });
      await this.invoke(
        run,
        join(this.dataDir, "scratch"),
        "Reply with exactly: SDD Clinic connection ready. Do not use tools.",
        undefined,
        signal,
      );
    });
  }
  async runCustom(project: Project, agentId: string, prompt: string) {
    assert(
      !containsConnectionDetails(prompt),
      "Use Save connection in project chat for credentials.",
    );
    const agent = (await this.projects.agents(project)).find(
      (a) => a.id === agentId,
    );
    assert(agent?.role === "custom", "Choose a custom agent for this task.");
    const config = await this.projects.config(project);
    const engine = agent.engine === "project" ? config.engine : agent.engine;
    this.engine(engine);
    const run = this.make(
      project.id,
      "custom",
      `${agent.name}: ${prompt.slice(0, 70)}`,
      engine,
      { agentId },
    );
    return this.begin(
      run,
      async (signal) => {
        await this.invoke(
          run,
          project.path,
          `Analyze this project and provide a report. Use read-only tools; do not change files. Project context: ${config.context}\nUser task: ${prompt}`,
          {
            ...agent,
            tools: agent.tools.filter((t) => t === "read" || t === "data"),
          },
          signal,
        );
      },
      `custom:${project.id}:${agentId}`,
    );
  }
  async chat(
    project: Project,
    input: {
      prompt: string;
      path: string;
      conversationId?: string;
      engine?: EngineKind;
      change?: string;
    },
  ) {
    assert(
      !containsConnectionDetails(input.prompt),
      "Use Save connection in project chat for credentials.",
    );
    const config = await this.projects.config(project);
    const kind = input.engine ?? config.engine;
    this.engine(kind);
    let conversation = input.conversationId
      ? this.store.require<Conversation>(
          "conversation",
          input.conversationId,
          project.id,
        )
      : undefined;
    const allFiles = await this.specs.list(project);
    const selected = input.path
      ? allFiles.find((f) => f.path === input.path)
      : undefined;
    assert(!input.path || selected, "Selected specification does not exist.");
    assert(
      !conversation ||
        conversation.contextPath === input.path ||
        (!!selected?.change && conversation.change === selected.change),
      "Conversation belongs to a different specification.",
    );
    const change = safeName(
      conversation?.change ??
        selected?.change ??
        input.change ??
        `update-${slug(selected?.name ?? "project")}-${id().slice(0, 6)}`,
    );
    const switched = conversation && conversation.engine !== kind;
    conversation = {
      id: conversation?.id ?? id(),
      projectId: project.id,
      contextPath: conversation?.contextPath ?? input.path,
      change,
      engine: kind,
      sessionId: switched ? undefined : conversation?.sessionId,
      messages: [
        ...(conversation?.messages ?? []),
        { role: "user", text: input.prompt, at: now() },
      ],
    };
    const conv = conversation;
    const relevant = allFiles.filter((f) => f.kind !== "archive");
    const pending = this.store
      .list<any>("proposal", project.id)
      .filter((p) => p.change === change && p.status === "pending")[0];
    const context = relevant
      .map((f) => `FILE ${f.path}\n${f.content}`)
      .join("\n\n");
    const prompt = `You are editing an OpenSpec change in SDD Clinic. Do not write files or execute commands. Return only a JSON object with summary (string) and files (array of {path,content}), containing complete revised file contents. All output paths MUST be inside openspec/changes/${change}/. Preserve existing requirements. Current main specs describe accepted behavior; proposed modifications belong in delta specs with ADDED/MODIFIED/REMOVED Requirements and WHEN/THEN scenarios. Include proposal.md (Why, What Changes, Capabilities with New/Modified, Impact), design.md, tasks.md, .openspec.yaml and applicable specs/<capability>/spec.md. Every new capability delta must start with a meaningful ## Purpose section before ## ADDED Requirements so archive creates a valid accepted spec. Every requirement needs at least one #### Scenario. Inferred existing behavior must be labelled for review.\n${await authoringInstructions(project, change)}\nProject context: ${config.context}\nSelected context: ${input.path || "Project source; inspect only necessary files using read tools."}\n${context.slice(0, 100000)}\nUnapplied proposal: ${pending ? JSON.stringify(pending.files.map((f: any) => ({ path: f.path, content: f.after }))).slice(0, 80000) : "none"}\nConversation context: ${conv.messages
      .slice(-8)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n")
      .slice(-30000)}\nUser request: ${input.prompt}`;
    const skillName =
      selected || pending || allFiles.some((f) => f.change === change)
        ? "refine-spec"
        : "create-spec";
    if (skillName === "refine-spec")
      assert(
        (await projectSkills(project)).some((s) => s.name === skillName),
        `Missing ${skillName} skill. Run Set up SDD for this project.`,
      );
    const run = this.make(
      project.id,
      "chat",
      `Edit ${selected?.name ?? "project specifications"}`,
      kind,
      { change, conversationId: conv.id, skillName },
    );
    const result = this.begin(
      run,
      async (signal) => {
        const response = await this.invoke(
          run,
          project.path,
          prompt,
          undefined,
          signal,
          conv.sessionId,
        );
        for (const original of relevant) {
          const current = await this.specs.file(project, original.path);
          assert(
            current.hash === original.hash,
            "A context file changed during generation. Review the latest file and retry.",
            409,
          );
        }
        const parsed = filesOutput.parse(parseJsonOutput(response.text));
        const proposal = await this.specs.propose(
          project,
          parsed.summary,
          parsed.files.map((f) => ({ path: f.path, after: f.content })),
          "agent",
          change,
          relevant.map((f) => ({ path: f.path, hash: f.hash })),
        );
        for (const older of this.store.list<any>("proposal", project.id))
          if (
            older.id !== proposal.id &&
            older.change === change &&
            older.status === "pending"
          )
            this.store.put("proposal", { ...older, status: "rejected" });
        this.store.put("conversation", {
          ...conv,
          sessionId: response.sessionId,
          messages: [
            ...conv.messages,
            { role: "assistant", text: parsed.summary, at: now() },
          ],
        });
        this.store.append(run.id, "proposal", {
          id: proposal.id,
          summary: parsed.summary,
        });
      },
      `chat:${project.id}:${change}`,
    );
    this.store.put("conversation", conv);
    return { run: result, conversation: conv };
  }
  private async git(cwd: string, args: string[]) {
    // Status polling must not refresh the index while a Developer commits.
    // Git still takes mandatory locks for add/commit/worktree operations.
    const result = await command("git", ["--no-optional-locks", ...args], {
      cwd,
      timeout: 60000,
    });
    assert(result.code === 0, `Git: ${result.stderr || result.stdout}`);
    return result.stdout.trim();
  }
  private async commit(cwd: string, message: string) {
    await this.git(cwd, ["add", "-A"]);
    await this.git(cwd, [
      "-c",
      "user.name=SDD Clinic",
      "-c",
      "user.email=clinic@localhost",
      "commit",
      "--allow-empty",
      "-m",
      message,
    ]);
    return this.git(cwd, ["rev-parse", "HEAD"]);
  }
  async develop(
    project: Project,
    name: string,
    agentId = "developer",
    baselineRef?: string,
    resumeWorkspace = false,
  ) {
    requireClearIntent(this.store, project.id, name);
    const change = await this.specs.refreshApproval(project, name);
    assert(
      change.approvedHash && ["ready", "review"].includes(change.state),
      "Approve and validate this change before development.",
    );
    const agent = (await this.projects.agents(project)).find(
      (a) => a.id === agentId,
    );
    assert(agent?.role === "developer", "Choose a Developer agent.");
    assert(
      agent.tools.includes("edit"),
      "Developer agent needs the edit tool.",
    );
    const config = await this.projects.config(project);
    const kind = agent.engine === "project" ? config.engine : agent.engine;
    this.engine(kind);
    const snapshot = await this.specs.snapshot(project, name);
    const baseline = await this.git(project.path, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${baselineRef || change.codeRevision || "HEAD"}^{commit}`,
    ]);
    const run = this.make(project.id, "developer", `Develop ${name}`, kind, {
      change: name,
      agentId: agent.id,
      specHash: snapshot.hash,
    });
    return this.begin(
      run,
      async (signal) => {
        const branch = `codex/clinic-${name}-${run.id.slice(0, 8)}`,
          workspace =
            resumeWorkspace && change.worktree
              ? change.worktree
              : join(this.dataDir, "workspaces", project.id, run.id);
        await mkdir(join(this.dataDir, "workspaces", project.id), {
          recursive: true,
        });
        if (!(resumeWorkspace && change.worktree))
          await this.git(project.path, [
            "worktree",
            "add",
            "-b",
            branch,
            workspace,
            baseline,
          ]);
        const files = (await this.specs.list(project)).filter(
          (f) => f.kind === "spec" || f.kind === "project" || f.change === name,
        );
        for (const file of files)
          await atomicWrite(
            await safePath(workspace, file.path),
            file.content,
            0o644,
          );
        for (const file of await schemaSupportFiles(project))
          await atomicWrite(
            await safePath(workspace, file.path),
            file.content,
            0o644,
          );
        for (const path of [
          "openspec/config.yaml",
          ".clinic/project.yaml",
          `openspec/changes/${name}/.openspec.yaml`,
        ]) {
          const contents = await readOptional(
            await safePath(project.path, path),
          );
          if (contents)
            await atomicWrite(await safePath(workspace, path), contents, 0o644);
        }
        await this.commit(
          workspace,
          `Clinic: approved specification for ${name}`,
        );
        this.store.put("change", {
          ...change,
          state: "developing",
          branch: resumeWorkspace ? change.branch : branch,
          worktree: workspace,
          baseRevision: baseline,
          updatedAt: now(),
        });
        this.store.put("run", { ...this.get(run.id), workspace });
        const prompt = `Implement the approved OpenSpec change ${name}. Read openspec/project/ and openspec/changes/${name}/proposal.md, research.md, design.md, validation.md, tasks.md and specs when present. Use the validation plan to produce scenario evidence; keep the approved plan unchanged. Follow existing repository instructions. Approved specification hash: ${snapshot.hash}. Do not alter requirements or design. You may mark completed tasks in tasks.md. Work only in this workspace. Do not merge, push, deploy, change Git configuration, or read production credentials. Write and run relevant tests. Project context: ${config.context}\nConfigured commands: ${JSON.stringify(config.commands)}\nReturn JSON {"summary":"result and limitations","questions":[]} after checking for unresolved product intent.`;
        const result = await this.invoke(
          run,
          workspace,
          `${prompt}\n${clarificationInstruction}\nEarlier product answers: ${answerContext(this.store, project.id, name)}`,
          agent,
          signal,
        );
        const completion = z
          .object({
            summary: z.string(),
            questions: z.array(z.string().min(1)).default([]),
          })
          .parse(parseJsonOutput(result.text));
        if (completion.questions.length)
          await this.pause(run, completion.questions, "implementation");
        assert(
          (await this.specs.snapshot({ ...project, path: workspace }, name))
            .hash === snapshot.hash,
          "Developer changed approved specification content. Review the workspace and revise the specification before continuing.",
        );
        const validation = await this.specs.validate(
          { ...project, path: workspace },
          name,
        );
        this.store.append(run.id, "spec-validation", {
          exitCode: validation.code,
          output: validation.stdout || validation.stderr,
        });
        assert(
          validation.code === 0,
          `Implementation specification validation failed: ${validation.stdout || validation.stderr}`,
        );
        const codeRevision = await this.commit(
          workspace,
          `Clinic: implement ${name}`,
        );
        this.store.put("run", { ...this.get(run.id), codeRevision });
        const next: ChangeRecord = {
          ...this.specs.change(project, name),
          state: "qa",
          codeRevision,
          updatedAt: now(),
        };
        this.store.put("change", next);
        const qaAgent = (await this.projects.agents(project)).find(
          (a) => a.role === "qa" && a.trigger === "after-development",
        );
        assert(
          qaAgent,
          "Configure a QA agent with the after-development trigger.",
        );
        const qa = await this.startQa(project, next, qaAgent);
        this.store.append(run.id, "qa-started", { runId: qa.id });
      },
      `delivery:${project.id}:${name}`,
    );
  }
  async retryQa(project: Project, name: string, agentId?: string) {
    requireClearIntent(this.store, project.id, name);
    const change = await this.specs.refreshApproval(project, name);
    assert(
      !["developing", "qa"].includes(change.state),
      "Wait for the active delivery run.",
      409,
    );
    assert(
      change.codeRevision && change.approvedHash,
      "This change needs an approved implementation before QA.",
    );
    assert(
      change.worktree && !change.finalRevision,
      "QA requires an active implementation workspace.",
    );
    assert(
      !(await this.git(change.worktree, ["status", "--porcelain"])),
      "Commit or discard manual implementation edits before running QA.",
    );
    assert(
      (await this.specs.snapshot({ ...project, path: change.worktree }, name))
        .hash === change.approvedHash,
      "The implementation specification differs from the approved revision.",
    );
    change.codeRevision = await this.git(change.worktree, [
      "rev-parse",
      "HEAD",
    ]);
    change.qaRunId = undefined;
    this.store.put("change", change);
    const agent = (await this.projects.agents(project)).find(
      (a) => a.role === "qa" && (!agentId || a.id === agentId),
    );
    assert(agent, "Configure a QA agent.");
    return this.startQa(project, change, agent);
  }
  async review(project: Project, name: string) {
    requireClearIntent(this.store, project.id, name);
    const change = await this.specs.refreshApproval(project, name);
    assert(
      change.worktree && change.branch && change.baseRevision,
      "This change has no implementation workspace yet.",
    );
    const codeRevision = await this.git(change.worktree, ["rev-parse", "HEAD"]);
    const uncommitted = await this.git(change.worktree, [
      "status",
      "--porcelain",
    ]);
    const qa = change.qaRunId
      ? this.get(change.qaRunId, project.id)
      : undefined;
    const qaCurrent = Boolean(
      !uncommitted &&
      codeRevision === (change.finalRevision ?? change.codeRevision) &&
      qa?.status === "completed" &&
      qa.qa?.verdict === "passed" &&
      qa.specHash === change.approvedHash,
    );
    if (change.state === "review" && !qaCurrent)
      this.store.put("change", {
        ...change,
        state: "ready",
        qaRunId: undefined,
        updatedAt: now(),
      });
    const diff = await this.git(change.worktree, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      change.baseRevision,
      codeRevision,
      "--",
    ]);
    const files = await this.git(change.worktree, [
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--stat",
      change.baseRevision,
      codeRevision,
      "--",
    ]);
    return {
      branch: change.branch,
      baseRevision: change.baseRevision,
      codeRevision,
      worktree: change.worktree,
      files,
      diff,
      uncommitted,
      qaCurrent,
    };
  }
  private async startQa(
    project: Project,
    change: ChangeRecord,
    agent: AgentDefinition,
  ) {
    requireClearIntent(this.store, project.id, change.name);
    const config = await this.projects.config(project);
    const kind = agent.engine === "project" ? config.engine : agent.engine;
    this.engine(kind);
    const run = this.make(project.id, "qa", `Verify ${change.name}`, kind, {
      change: change.name,
      agentId: agent.id,
      specHash: change.approvedHash,
      codeRevision: change.codeRevision,
    });
    assert(
      !this.busy.has(`qa:${project.id}:${change.name}`),
      "QA is already running for this change.",
      409,
    );
    this.store.put("change", {
      ...change,
      state: "qa",
      qaRunId: run.id,
      updatedAt: now(),
    });
    return this.begin(
      run,
      async (signal) => {
        const workspace = join(this.dataDir, "workspaces", project.id, run.id);
        await this.git(project.path, [
          "worktree",
          "add",
          "--detach",
          workspace,
          change.codeRevision!,
        ]);
        this.store.put("run", { ...this.get(run.id), workspace });
        const checks: CheckResult[] = [];
        let setupFailed = false;
        for (const check of config.commands) {
          if (setupFailed) {
            checks.push({
              name: check.name,
              status: "unverified",
              output: "Dependency setup did not complete.",
              exitCode: null,
            });
            continue;
          }
          try {
            const cwd =
              check.cwd === "."
                ? workspace
                : await safePath(workspace, check.cwd);
            const env = cleanEnv();
            for (const key of [
              "OPENAI_API_KEY",
              "ANTHROPIC_API_KEY",
              "CODEX_API_KEY",
              "SSH_AUTH_SOCK",
              "CODEX_HOME",
            ])
              delete env[key];
            const result = await command(check.command, check.args, {
              cwd,
              timeout: Math.min(agent.timeoutMinutes * 60000, 300000),
              signal,
              env,
            });
            const output = String(
              redact(`${result.stdout}\n${result.stderr}`),
            ).slice(-30000);
            const unavailable =
              /command not found|Cannot find module|No module named|ENOENT|not installed/i.test(
                output,
              );
            const status =
              result.code === 0
                ? "passed"
                : unavailable || check.phase === "setup"
                  ? "unverified"
                  : "failed";
            checks.push({
              name: check.name,
              status,
              output,
              exitCode: result.code,
            });
            if (check.phase === "setup" && status !== "passed")
              setupFailed = true;
          } catch (e) {
            if (signal.aborted) throw e;
            checks.push({
              name: check.name,
              status: "unverified",
              output: errorText(e),
              exitCode: null,
            });
            if (check.phase === "setup") setupFailed = true;
          }
          this.store.append(run.id, "check", checks.at(-1));
        }
        if (!config.commands.some((c) => c.phase === "check"))
          checks.push({
            name: "Project checks",
            status: "unverified",
            output: "No test/check commands are configured for this project.",
            exitCode: null,
          });
        const snapshot = await this.specs.snapshot(
          { ...project, path: workspace },
          change.name,
        );
        assert(
          snapshot.hash === change.approvedHash,
          "QA specification differs from the approved revision.",
        );
        const scenarios = snapshot.files
          .filter((f) => f.path.includes("/specs/"))
          .flatMap((f) =>
            [...f.content.matchAll(/^#### Scenario:\s*(.+)$/gm)].map((m) =>
              m[1]!.trim(),
            ),
          );
        const response = await this.invoke(
          run,
          workspace,
          `${clarificationInstruction}\nEarlier product answers: ${answerContext(this.store, project.id, change.name)}\nIndependently verify this implementation against the approved OpenSpec change ${change.name}. Do not modify files. Read source and relevant specifications. Return JSON only: {"summary":"...","criteria":[{"scenario":"exact scenario title","status":"passed|failed|unverified","evidence":"specific test/output/source evidence"}]}. Include every scenario. Do not infer a pass solely from the developer's report. Missing or insufficient evidence is unverified.\nScenarios: ${JSON.stringify(scenarios)}\nChecks: ${JSON.stringify(checks)}\nSpecification: ${snapshot.files
            .map((f) => f.content)
            .join("\n")
            .slice(0, 90000)}`,
          agent,
          signal,
        );
        const raw = parseJsonOutput(response.text) as { questions?: string[] };
        if (raw.questions?.length)
          await this.pause(
            run,
            z.array(z.string().min(1)).parse(raw.questions),
            "qa",
          );
        const parsed = qaOutput.parse(raw);
        const criteria = scenarios.map(
          (s) =>
            parsed.criteria.find((c) => c.scenario === s) ?? {
              scenario: s,
              status: "unverified" as const,
              evidence: "QA did not provide evidence for this scenario.",
            },
        );
        const dirty = await this.git(workspace, ["status", "--porcelain"]);
        if (dirty)
          checks.push({
            name: "Frozen workspace",
            status: "unverified",
            output:
              "QA commands or agent changed tracked/untracked files. Inspect the QA workspace before accepting.",
            exitCode: null,
          });
        const statuses = [...checks, ...criteria].map((c) => c.status);
        const verdict = statuses.includes("failed")
          ? "failed"
          : !criteria.length || statuses.includes("unverified")
            ? "unverified"
            : "passed";
        const report: QaReport = {
          verdict,
          checks,
          criteria,
          summary: parsed.summary,
          specHash: change.approvedHash!,
          codeRevision: change.codeRevision!,
        };
        this.store.put("run", { ...this.get(run.id), qa: report });
        const current = await this.specs.refreshApproval(project, change.name);
        assert(
          current.approvedHash === change.approvedHash,
          "The approved specification changed during QA.",
        );
        this.store.put("change", {
          ...current,
          state: verdict === "passed" ? "review" : "ready",
          qaRunId: run.id,
          updatedAt: now(),
        });
        this.store.append(run.id, "qa-report", report);
        if (verdict !== "passed") {
          const evidence = this.store.put<Evidence>("evidence", {
            id: id(),
            projectId: project.id,
            connectionId: "",
            source: `qa:${run.id}`,
            observedAt: now(),
            result: report,
            rowCount: checks.length,
            truncated: false,
          });
          this.recordFinding(project.id, {
            title: `${verdict === "failed" ? "QA failures" : "Verification needed"}: ${change.name}`,
            kind: verdict === "failed" ? "bug" : "investigation",
            feature: change.name,
            evidenceIds: [evidence.id],
            observed: parsed.summary,
            expected:
              "All approved acceptance scenarios and project checks pass.",
            uncertainty:
              verdict === "unverified"
                ? "Some checks could not be verified."
                : "Failures require developer review.",
            action: "Review QA evidence and revise the implementation.",
            priority: "medium",
            rationale: "Required acceptance checks are not all verified.",
            period: "This implementation revision",
            fingerprint: `qa:${change.name}`,
            confirmed: verdict === "failed",
          });
        }
      },
      `qa:${project.id}:${change.name}`,
    );
  }
  async finalize(project: Project, name: string) {
    return this.finalizeLocks.with(`${project.id}:${name}`, () =>
      this.finalizeChange(project, name),
    );
  }
  private async finalizeChange(project: Project, name: string) {
    requireClearIntent(this.store, project.id, name);
    const change = await this.specs.refreshApproval(project, name);
    assert(
      change.state === "review" && change.worktree && change.qaRunId,
      "A passed QA review is required before finalizing.",
    );
    const qa = this.get(change.qaRunId, project.id);
    assert(
      qa.status === "completed" &&
        qa.qa?.verdict === "passed" &&
        qa.specHash === change.approvedHash &&
        qa.codeRevision === change.codeRevision,
      "QA evidence is missing or stale.",
    );
    assert(
      (await this.git(change.worktree, ["rev-parse", "HEAD"])) ===
        change.codeRevision,
      "Implementation changed after QA. Run QA again.",
    );
    assert(
      !(await this.git(change.worktree, ["status", "--porcelain"])),
      "Implementation workspace has uncommitted changes.",
    );
    const snapshot = await this.specs.snapshot(
      { ...project, path: change.worktree },
      name,
    );
    assert(
      snapshot.hash === change.approvedHash,
      "Specification changed after QA.",
    );
    assert(
      !snapshot.files.some(
        (f) => f.path.endsWith("/tasks.md") && /- \[ \]/.test(f.content),
      ),
      "Complete or revise remaining implementation tasks before finalizing.",
    );
    const validation = await this.specs.validate(
      { ...project, path: change.worktree },
      name,
    );
    assert(validation.code === 0, validation.stdout || validation.stderr);
    const archive = await this.specs.openSpec(change.worktree, [
      "archive",
      name,
      "--yes",
      "--json",
    ]);
    assert(archive.code === 0, archive.stdout || archive.stderr);
    const finalRevision = await this.commit(
      change.worktree,
      `Clinic: finalize specification ${name}`,
    );
    return this.store.put("change", {
      ...change,
      state: "ready-to-integrate",
      finalRevision,
      updatedAt: now(),
    });
  }
  async verifyIntegration(project: Project, name: string) {
    const change = this.specs.change(project, name);
    assert(change.finalRevision, "Finalize the change first.");
    const config = await this.projects.config(project);
    const target = await this.git(project.path, [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${config.targetBranch}^{commit}`,
    ]);
    const result = await command(
      "git",
      ["merge-base", "--is-ancestor", change.finalRevision, target],
      { cwd: project.path },
    );
    assert(
      result.code === 0,
      `The finalized commit is not yet an ancestor of ${config.targetBranch}. Integrate the branch through your Git workflow first.`,
    );
    return this.store.put("change", {
      ...change,
      state: "done",
      updatedAt: now(),
    });
  }
  recordFinding(projectId: string, input: unknown) {
    const parsed = findingSchema.parse(input);
    for (const evidenceId of parsed.evidenceIds)
      this.store.require<Evidence>("evidence", evidenceId, projectId);
    if (parsed.kind === "bug" && !parsed.confirmed)
      parsed.kind = "investigation";
    const fingerprint = hash(`${parsed.feature}\0${parsed.fingerprint}`);
    const existing = this.store
      .list<Finding>("finding", projectId)
      .find((f) => f.fingerprint === fingerprint);
    return this.store.put<Finding>("finding", {
      ...parsed,
      fingerprint,
      id: existing?.id ?? id(),
      projectId,
      status: existing?.status ?? "triage",
      change: existing?.change,
      evidenceIds: [
        ...new Set([...(existing?.evidenceIds ?? []), ...parsed.evidenceIds]),
      ].slice(-100),
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    });
  }
  async analyze(
    project: Project,
    agentId = "po",
    suggestMappings = false,
    task = "",
  ) {
    assert(
      !containsConnectionDetails(task),
      "Use Save connection in project chat for credentials.",
    );
    const agent = (await this.projects.agents(project)).find(
      (a) => a.id === agentId,
    );
    assert(agent?.role === "po", "Choose a PO agent.");
    assert(agent.tools.includes("data"), "PO agent needs the data tool.");
    const config = await this.projects.config(project);
    const kind = agent.engine === "project" ? config.engine : agent.engine;
    this.engine(kind);
    const run = this.make(
      project.id,
      "po",
      suggestMappings ? "Suggest feature metrics" : "Analyze product evidence",
      kind,
      { agentId: agent.id },
    );
    return this.begin(
      run,
      async (signal) => {
        const workspace = join(this.dataDir, "analysis", project.id);
        await mkdir(workspace, { recursive: true });
        const profiles = this.broker
          .forAgent(project.id, agent.id, agent.role)
          .map(({ id, name, kind, allowedPaths }) => ({
            id,
            name,
            kind,
            allowedPaths,
          }));
        const mappings = this.store
          .list<MetricMapping>("metric", project.id)
          .filter(
            (m) => m.reviewed && profiles.some((p) => p.id === m.connectionId),
          );
        const evidence: Evidence[] = [];
        if (!suggestMappings)
          for (const mapping of mappings) {
            if (signal.aborted) throw new AppError("Run interrupted.");
            try {
              const item = await this.broker.query(
                project.id,
                mapping.connectionId,
                mapping.query,
                mapping.period,
              );
              evidence.push(item);
              this.store.append(run.id, "evidence", {
                id: item.id,
                feature: mapping.feature,
                rowCount: item.rowCount,
              });
            } catch (e) {
              this.store.append(run.id, "diagnostic", {
                metric: mapping.name,
                message: errorText(e),
              });
            }
          }
        const specs = (await this.specs.list(project))
          .filter((f) => f.kind === "spec")
          .map((f) => `${f.path}\n${f.content}`)
          .join("\n")
          .slice(0, 60000);
        const format = suggestMappings
          ? 'Return JSON {"metrics":[{"name":"...","feature":"...","connectionId":"...","query":"...","expected":"...","period":"...","reviewed":false}]}. Use Clinic schema tools to inspect real columns before proposing queries. Do not mark metrics reviewed.'
          : 'Return JSON {"findings":[{"title":"...","kind":"bug|improvement|investigation|instrumentation","feature":"...","evidenceIds":["actual broker evidence ID"],"observed":"...","expected":"...","uncertainty":"...","action":"...","priority":"low|medium|high","rationale":"...","sampleSize":null,"denominator":null,"period":"...","fingerprint":"stable finding key","confirmed":false}]}. Use only existing evidence IDs. Missing data can justify an instrumentation proposal grounded in schema evidence. Anomalies alone are not confirmed bugs. An empty findings array is acceptable.';
        const result = await this.invoke(
          run,
          workspace,
          `${format}\nProject: ${project.name}\nContext: ${config.context}\nUser task: ${task}\nCurrent specifications: ${specs || "No accepted specifications yet. Describe uncertainty."}\nConnections (no secrets): ${JSON.stringify(profiles)}\nReviewed metrics: ${JSON.stringify(mappings)}\nEvidence: ${JSON.stringify(evidence).slice(0, 150000)}\nUse Clinic broker tools to inspect schemas, query bounded read-only data, and read permitted server evidence. Never request credentials or invoke shell commands.`,
          agent,
          signal,
        );
        const output = parseJsonOutput(result.text);
        if (suggestMappings) {
          const parsed = z
            .object({ metrics: z.array(metricSchema) })
            .parse(output);
          for (const metric of parsed.metrics) {
            this.store.require<ConnectionProfile>(
              "connection",
              metric.connectionId,
              project.id,
            );
            this.store.put("metric", {
              ...metric,
              id: id(),
              projectId: project.id,
              reviewed: false,
            });
          }
          this.store.append(run.id, "metrics", {
            count: parsed.metrics.length,
          });
        } else {
          const parsed = z
            .object({ findings: z.array(findingSchema) })
            .parse(output);
          for (const finding of parsed.findings)
            this.recordFinding(project.id, finding);
          this.store.append(run.id, "findings", {
            count: parsed.findings.length,
          });
        }
      },
      `po:${project.id}`,
    );
  }
  async convertFinding(project: Project, findingId: string) {
    const finding = this.store.require<Finding>(
      "finding",
      findingId,
      project.id,
    );
    assert(!finding.change, "This finding already has a proposed change.");
    const name = `${slug(finding.title)}-${id().slice(0, 6)}`;
    const proposal = await this.specs.createChange(
      project,
      name,
      finding.title,
      `${finding.observed}\n\nExpected: ${finding.expected}\n\nSuggested action: ${finding.action}\n\nEvidence: ${finding.evidenceIds.join(", ")}`,
    );
    await this.specs.apply(project, proposal.id);
    this.store.put("finding", {
      ...finding,
      status: "converted",
      change: name,
      updatedAt: now(),
    });
    return { name };
  }
  async scheduleTick(startup = false, date = new Date()) {
    for (const schedule of this.store.list<Schedule>("schedule")) {
      if (!schedule.enabled || new Date(schedule.nextRunAt) > date) continue;
      const next = new Date(
        date.getTime() + schedule.intervalHours * 3600000,
      ).toISOString();
      this.store.put("schedule", {
        ...schedule,
        nextRunAt: next,
        ...(startup
          ? {
              skipped:
                (schedule.skipped ?? 0) +
                Math.floor(
                  (date.getTime() - Date.parse(schedule.nextRunAt)) /
                    (schedule.intervalHours * 3600000),
                ) +
                1,
            }
          : { lastRunAt: date.toISOString() }),
      });
      if (startup) continue;
      try {
        assert(
          this.store
            .list<MetricMapping>("metric", schedule.projectId)
            .some((m) => m.reviewed),
          "Review metric mappings before enabling scheduled analysis.",
        );
        await this.analyze(this.projects.get(schedule.projectId));
      } catch (e) {
        this.store.put("schedule", {
          ...this.store.require<Schedule>("schedule", schedule.id),
          lastError: errorText(e),
        });
      }
    }
  }
}
