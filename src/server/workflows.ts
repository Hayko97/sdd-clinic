import {
  ask,
  answerQuestion,
  answerContext,
  clarificationInstruction,
} from "./clarification.js";
import { z } from "zod";
import type { DeveloperWorkflow, Project, Proposal } from "../shared/types.js";
import { Runs } from "./runs.js";
import { projectSkills } from "./skills.js";
import { authoringInstructions } from "./documentation.js";
import { containsConnectionDetails } from "../shared/connection-input.js";
import {
  assert,
  errorText,
  id,
  now,
  parseJsonOutput,
  safeName,
  hash,
  readOptional,
  safePath,
} from "./util.js";
const decisionSchema = z.object({
  summary: z.string().min(1),
  action: z.enum(["create", "refine", "implement", "clarify"]),
  path: z.string().optional(),
  change: z.string().optional(),
  questions: z.array(z.string()).default([]),
});
const proposalSchema = z.object({
  summary: z.string(),
  files: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .max(100)
    .default([]),
  questions: z.array(z.string().min(1)).default([]),
});
export class Workflows {
  private starting = new Set<string>();
  constructor(readonly runs: Runs) {
    for (const flow of runs.store.list<DeveloperWorkflow>("workflow"))
      if (["analyzing", "specifying", "continuing"].includes(flow.stage))
        this.update(flow, {
          stage: "interrupted",
          error:
            "Service stopped during the workflow. Inspect preserved artifacts before retrying.",
        });
  }
  get store() {
    return this.runs.store;
  }
  get(project: Project, workflowId: string) {
    return this.store.require<DeveloperWorkflow>(
      "workflow",
      workflowId,
      project.id,
    );
  }
  update(flow: DeveloperWorkflow, values: Partial<DeveloperWorkflow>) {
    return this.store.put("workflow", { ...flow, ...values, updatedAt: now() });
  }
  list(project: Project) {
    return this.store
      .list<DeveloperWorkflow>("workflow", project.id)
      .map((flow) => {
        flow = {
          ...flow,
          clarifications: this.store
            .list<import("../shared/types.js").Clarification>(
              "clarification",
              project.id,
            )
            .filter(
              (q) =>
                flow.clarifications?.some((previous) => previous.id === q.id) ||
                q.ownerId === flow.id ||
                q.ownerId === flow.runId ||
                (!!flow.change &&
                  ["implementing", "qa", "needs-input"].includes(flow.stage) &&
                  q.change === flow.change),
            ),
        };
        const pending = this.store
          .list<import("../shared/types.js").Clarification>(
            "clarification",
            project.id,
          )
          .find(
            (q) =>
              q.status === "pending" &&
              (q.ownerId === flow.id ||
                q.ownerId === flow.runId ||
                (!!flow.change &&
                  ["implementing", "qa", "needs-input"].includes(flow.stage) &&
                  q.change === flow.change)),
          )?.id;
        const q = pending
          ? this.store.get<import("../shared/types.js").Clarification>(
              "clarification",
              pending,
            )
          : undefined;
        if (q?.status === "pending" && flow.stage !== "canceled")
          return this.update(flow, {
            stage: "needs-input",
            clarificationId: q.id,
            resumeStage: q.stage,
            summary: q.questions.join("\n\n"),
          });
        if (
          flow.stage === "needs-input" &&
          flow.clarificationId &&
          this.store.get<import("../shared/types.js").Clarification>(
            "clarification",
            flow.clarificationId,
          )?.status === "canceled"
        )
          return this.update(flow, { stage: "canceled" });
        if (
          !flow.runId ||
          [
            "canceled",
            "failed",
            "interrupted",
            "awaiting-review",
            "needs-input",
            "review",
          ].includes(flow.stage)
        )
          return flow;
        const run = this.runs.get(flow.runId, project.id);
        if (["failed", "interrupted"].includes(run.status))
          return this.update(flow, {
            stage: run.status as "failed" | "interrupted",
            error: run.error,
          });
        if (flow.change && ["implementing", "qa"].includes(flow.stage)) {
          const change = this.runs.specs.change(project, flow.change);
          if (change.qaRunId) {
            const qa = this.runs.get(change.qaRunId, project.id);
            return this.update(flow, {
              stage:
                qa.status === "completed"
                  ? qa.qa?.verdict === "passed"
                    ? "review"
                    : "failed"
                  : ["failed", "interrupted"].includes(qa.status)
                    ? "failed"
                    : "qa",
              error:
                qa.status === "completed" && qa.qa?.verdict !== "passed"
                  ? qa.qa?.summary
                  : qa.error,
            });
          }
        }
        return flow;
      });
  }
  async start(
    project: Project,
    prompt: string,
    agentId = "developer",
    previousWorkflowId?: string,
  ) {
    assert(
      !containsConnectionDetails(prompt),
      "Use Save connection in the project composer for credentials, then ask the agent to use the saved source.",
    );
    const key = `${project.id}:${agentId}`;
    assert(
      !this.starting.has(key),
      "This Developer is already starting a workflow.",
      409,
    );
    this.starting.add(key);
    try {
      return await this.startReserved(
        project,
        prompt,
        agentId,
        previousWorkflowId,
      );
    } finally {
      this.starting.delete(key);
    }
  }
  private async startReserved(
    project: Project,
    prompt: string,
    agentId: string,
    previousWorkflowId?: string,
    resume?: DeveloperWorkflow,
  ) {
    const previous = previousWorkflowId
      ? this.get(project, previousWorkflowId)
      : undefined;
    if (previous) {
      assert(
        previous.agentId === agentId,
        "Previous conversation belongs to a different agent.",
        409,
      );
      assert(
        ["review", "failed", "interrupted", "canceled"].includes(
          previous.stage,
        ),
        "Finish or cancel the previous workflow before sending a follow-up.",
        409,
      );
    }
    const previousContext = previous
      ? JSON.stringify({
          prompt: previous.prompt,
          summary: previous.summary,
          change: previous.change,
          error: previous.error,
        }).slice(0, 16000)
      : "None";
    const agent = (await this.runs.projects.agents(project)).find(
      (a) => a.id === agentId,
    );
    assert(
      agent?.role === "developer",
      "Choose a Developer agent from this project.",
    );
    assert(
      !this.list(project).some(
        (f) =>
          f.id !== resume?.id &&
          f.agentId === agentId &&
          !["review", "failed", "interrupted", "canceled"].includes(f.stage),
      ),
      "This Developer already has a workflow. Continue or cancel it first.",
      409,
    );
    const skills = await projectSkills(project);
    for (const name of [
      "analyze-request",
      "create-spec",
      "refine-spec",
      "implement-spec",
    ])
      assert(
        skills.some((s) => s.name === name),
        `Missing ${name}. Run Set up SDD first.`,
      );
    const flow: DeveloperWorkflow = {
      ...resume,
      id: resume?.id ?? id(),
      projectId: project.id,
      agentId,
      previousWorkflowId,
      prompt,
      stage: "analyzing",
      createdAt: resume?.createdAt ?? now(),
      updatedAt: now(),
    };
    this.store.put("workflow", flow);
    try {
      const files = (await this.runs.specs.list(project)).filter(
        (f) => f.kind !== "archive",
      );
      const config = await this.runs.projects.config(project);
      const context = files
        .map((f) => `FILE ${f.path}\n${f.content}`)
        .join("\n\n")
        .slice(0, 180000);
      const run = await this.runs.skillRun(
        project,
        agent,
        "analyze-request",
        `${clarificationInstruction}\nEarlier clarification: ${answerContext(this.store, project.id, flow.change)} ${answerContext(this.store, project.id, undefined, flow.id)}\nExisting workflow change: ${flow.change ?? "none"}. Preserve it when refining. Analyze the user's intent and relevant specs. Return JSON only: {"summary":"...","action":"create|refine|implement|clarify","path":"existing spec path if applicable","change":"existing active change if applicable","questions":[]}. Use implement only if a current active change already covers the request. Use clarify only for essential missing intent. Do not edit files.\nProject: ${config.context}\n${context}\nEarlier conversation (context only): ${previousContext}\nUser prompt: ${prompt}`,
        async (text, analysisRun) => {
          let current = this.get(project, flow.id);
          if (current.stage === "canceled") return;
          const decision = decisionSchema.parse(parseJsonOutput(text));
          current = this.update(current, {
            summary: decision.summary,
            runId: analysisRun.id,
          });
          if (decision.action === "clarify" || decision.questions.length) {
            const q = ask(this.store, {
              projectId: project.id,
              ownerId: flow.id,
              stage: "analysis",
              questions: decision.questions.length
                ? decision.questions
                : [decision.summary],
              change: flow.change,
            });
            this.update(current, {
              clarificationId: q.id,
              resumeStage: "analysis",
              stage: "needs-input",
              summary: [decision.summary, ...decision.questions].join("\n"),
            });
            return;
          }
          if (decision.path)
            assert(
              files.some((f) => f.path === decision.path),
              "Analysis referenced a specification outside this project.",
            );
          if (decision.change)
            for (const q of this.store.list<
              import("../shared/types.js").Clarification
            >("clarification", project.id))
              if (q.ownerId === flow.id && q.status === "answered" && !q.change)
                this.store.put("clarification", {
                  ...q,
                  change: decision.change,
                });
          if (decision.action === "implement") {
            assert(
              decision.change &&
                files.some((f) => f.change === decision.change),
              "Analysis must select an existing project change.",
            );
            const change = await this.runs.specs.refreshApproval(
              project,
              decision.change,
            );
            current = this.update(current, { change: decision.change });
            if (
              change.approvedHash &&
              ["ready", "review"].includes(change.state)
            ) {
              if (change.worktree) {
                try {
                  if (
                    (await this.runs.review(project, change.name)).qaCurrent
                  ) {
                    this.update(current, {
                      stage: "review",
                      summary:
                        "Current implementation already has passing QA. Review its evidence.",
                    });
                    return;
                  }
                } catch {}
              }
              const child =
                flow.resumeStage === "qa"
                  ? await this.runs.retryQa(project, decision.change)
                  : await this.runs.develop(
                      project,
                      decision.change,
                      agentId,
                      undefined,
                      flow.resumeWorkspace,
                    );

              if (this.get(project, flow.id).stage === "canceled") {
                if (this.runs.active.has(child.id)) this.runs.cancel(child.id);
                return;
              }
              this.update(current, {
                stage: flow.resumeStage === "qa" ? "qa" : "implementing",
                runId: child.id,
              });
              return;
            }
            this.update(current, {
              stage: "awaiting-review",
              reviewHash: (
                await this.runs.specs.snapshot(project, decision.change)
              ).hash,
              summary: `${decision.summary}\nReview and approve the existing change before continuing.`,
            });
            return;
          }
          const selected = decision.path
            ? files.find((f) => f.path === decision.path)
            : undefined;
          if (decision.change)
            assert(
              files.some((f) => f.change === decision.change),
              "Selected change is not in this project.",
            );
          const change = safeName(
            selected?.change ??
              decision.change ??
              flow.change ??
              `request-${flow.id.slice(0, 8)}`,
          );
          const skill =
            decision.action === "refine" ? "refine-spec" : "create-spec";
          if (skill === "refine-spec")
            assert(
              selected || decision.change,
              "Refinement requires an existing specification or change.",
            );
          current = this.update(current, { stage: "specifying", change });
          const author = await this.runs.skillRun(
            project,
            agent,
            skill,
            `${clarificationInstruction}\nEarlier product answers: ${answerContext(this.store, project.id, flow.change)} ${answerContext(this.store, project.id, undefined, flow.id)}\nPropose an OpenSpec change, without writing files. Return JSON only: {"summary":"...","files":[{"path":"...","content":"complete file contents"}]}. All paths MUST be inside openspec/changes/${change}/. Include proposal.md with Why, What Changes, Capabilities (New/Modified) and Impact; design.md; tasks.md with test-linked checkboxes; .openspec.yaml (preserve existing schema); and specs/<capability>/spec.md with ADDED/MODIFIED/REMOVED Requirements and WHEN/THEN scenarios. Each new capability needs a meaningful ## Purpose before ## ADDED Requirements. Reuse existing requirements and capabilities, do not duplicate accepted intent.\n${await authoringInstructions(project, change)}\nAnalysis: ${decision.summary}\nSelected: ${decision.path ?? decision.change ?? "new change"}\nProject: ${config.context}\n${context}\nEarlier conversation (context only): ${previousContext}\nUser prompt: ${prompt}`,
            async (output, authorRun) => {
              const latest = this.get(project, flow.id);
              if (latest.stage === "canceled") return;
              const parsed = proposalSchema.parse(parseJsonOutput(output));
              if (parsed.questions.length) {
                const q = ask(this.store, {
                  projectId: project.id,
                  ownerId: flow.id,
                  stage: "specification",
                  questions: parsed.questions,
                  change,
                });
                this.update(latest, {
                  stage: "needs-input",
                  clarificationId: q.id,
                  resumeStage: "specification",
                  summary: parsed.questions.join("\n\n"),
                });
                return;
              }
              const proposal = await this.runs.specs.propose(
                project,
                parsed.summary,
                parsed.files.map((f) => ({ path: f.path, after: f.content })),
                "agent",
                change,
                files.map((f) => ({ path: f.path, hash: f.hash })),
              );
              if (this.get(project, flow.id).stage === "canceled") return;
              this.update(latest, {
                stage: "awaiting-review",
                proposalId: proposal.id,
                summary: parsed.summary,
                runId: authorRun.id,
              });
              this.store.append(authorRun.id, "proposal", {
                id: proposal.id,
                workflowId: flow.id,
              });
            },
          );
          const latest = this.get(project, flow.id);
          if (latest.stage === "specifying")
            this.update(latest, { runId: author.id });
          else if (
            latest.stage === "canceled" &&
            this.runs.active.has(author.id)
          )
            this.runs.cancel(author.id);
        },
      );
      const latest = this.get(project, flow.id);
      if (latest.stage === "analyzing") this.update(latest, { runId: run.id });
      return this.get(project, flow.id);
    } catch (error) {
      this.update(this.get(project, flow.id), {
        stage: "failed",
        error: errorText(error),
      });
      throw error;
    }
  }
  async continue(
    project: Project,
    workflowId: string,
    answer?: string,
    questionId?: string,
  ) {
    const flow = this.get(project, workflowId);
    if (flow.stage === "needs-input") {
      assert(
        !questionId || questionId === flow.clarificationId,
        "This answer refers to an obsolete question. Refresh before answering.",
        409,
      );
      assert(
        flow.clarificationId,
        "Refresh the pending question before answering.",
      );
      const q = this.store.require<import("../shared/types.js").Clarification>(
        "clarification",
        flow.clarificationId,
        project.id,
      );
      if (q.specHash && q.change)
        assert(
          (await this.runs.specs.snapshot(project, q.change)).hash ===
            q.specHash,
          "Specification changed while waiting. Cancel and reanalyze before answering.",
          409,
        );
      assert(
        !this.runs.active.has(q.ownerId),
        "The agent is stopping at this checkpoint. Retry in a moment.",
        409,
      );
      const answered = answerQuestion(
        this.store,
        project,
        q.id,
        answer ?? "",
        q.ownerId,
      );
      const pausedRun = this.store.get<import("../shared/types.js").Run>(
        "run",
        q.ownerId,
      );
      if (pausedRun)
        this.store.put("run", {
          ...pausedRun,
          status: "interrupted",
          endedAt: now(),
          error: "Resumed after product clarification in the same workflow.",
        });
      const next = this.update(flow, {
        stage: "analyzing",
        clarificationId: undefined,
        resumeStage: q.stage,
        resumeWorkspace:
          flow.resumeWorkspace ||
          ["implementation", "developer", "qa"].includes(q.stage),
        prompt:
          flow.prompt + `\nProduct decision (${q.stage}): ${answered.answer}`,
      });
      try {
        return await this.startReserved(
          project,
          next.prompt,
          flow.agentId,
          undefined,
          next,
        );
      } catch (error) {
        this.update(next, { stage: "failed", error: errorText(error) });
        throw error;
      }
    }
    if (["failed", "interrupted"].includes(flow.stage))
      return this.startReserved(
        project,
        flow.prompt,
        flow.agentId,
        undefined,
        flow,
      );
    assert(
      flow.stage === "awaiting-review",
      "This workflow is not waiting for spec approval.",
      409,
    );
    this.update(flow, { stage: "continuing" });
    try {
      assert(flow.change, "Workflow has no change.");
      if (flow.proposalId) {
        const proposal = this.store.require<Proposal>(
          "proposal",
          flow.proposalId,
          project.id,
        );
        assert(
          proposal.status !== "rejected",
          "This proposal was rejected; start a new request.",
        );
        if (proposal.status === "pending")
          await this.runs.specs.apply(project, proposal.id);
        else
          for (const edit of proposal.files)
            assert(
              hash(
                (await readOptional(await safePath(project.path, edit.path))) ??
                  "",
              ) === hash(edit.after),
              "The applied proposal changed after review. Review a new proposal before continuing.",
              409,
            );
      }
      if (flow.reviewHash)
        assert(
          (await this.runs.specs.snapshot(project, flow.change)).hash ===
            flow.reviewHash,
          "The change was edited after the workflow review. Start a new review.",
          409,
        );
      assert(
        this.get(project, workflowId).stage !== "canceled",
        "Workflow canceled.",
      );
      await this.runs.specs.approve(project, flow.change);
      assert(
        this.get(project, workflowId).stage !== "canceled",
        "Workflow canceled.",
      );
      const run = await this.runs.develop(
        project,
        flow.change,
        flow.agentId,
        undefined,
        flow.resumeWorkspace,
      );
      if (this.get(project, workflowId).stage === "canceled") {
        if (this.runs.active.has(run.id)) this.runs.cancel(run.id);
        return this.get(project, workflowId);
      }
      return this.update(flow, {
        stage: "implementing",
        runId: run.id,
        error: undefined,
      });
    } catch (error) {
      if (this.get(project, workflowId).stage !== "canceled")
        this.update(flow, {
          stage: "awaiting-review",
          error: errorText(error),
        });
      throw error;
    }
  }
  cancel(project: Project, workflowId: string) {
    const flow = this.get(project, workflowId);
    for (const q of this.store.list<import("../shared/types.js").Clarification>(
      "clarification",
      project.id,
    ))
      if (
        q.status === "pending" &&
        (q.id === flow.clarificationId ||
          q.ownerId === flow.runId ||
          q.ownerId === flow.id)
      ) {
        this.store.put("clarification", { ...q, status: "canceled" });
        const paused = this.store.get<import("../shared/types.js").Run>(
          "run",
          q.ownerId,
        );
        if (paused && !this.runs.active.has(paused.id))
          this.store.put("run", {
            ...paused,
            status: "interrupted",
            endedAt: now(),
            error: "Clarification canceled; partial work is preserved.",
          });
      }
    if (flow.runId && this.runs.active.has(flow.runId))
      this.runs.cancel(flow.runId);
    if (flow.change) {
      const change = this.runs.specs.change(project, flow.change);
      if (change.qaRunId && this.runs.active.has(change.qaRunId))
        this.runs.cancel(change.qaRunId);
    }
    return this.update(flow, { stage: "canceled" });
  }
}
