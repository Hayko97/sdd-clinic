import { readdir } from "node:fs/promises";
import { parse, stringify } from "yaml";
import {
  agentScheduleSchema,
  type AgentSchedule,
  type Project,
  type Run,
} from "../shared/types.js";
import { Workflows } from "./workflows.js";
import {
  assert,
  atomicWrite,
  errorText,
  hash,
  now,
  readOptional,
  safeName,
  safePath,
} from "./util.js";
export class AgentSchedules {
  private ticking = false;
  constructor(readonly workflows: Workflows) {}
  get runs() {
    return this.workflows.runs;
  }
  async list(project: Project): Promise<AgentSchedule[]> {
    let names: string[];
    try {
      names = await readdir(await safePath(project.path, ".clinic/schedules"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
    const result: AgentSchedule[] = [];
    for (const name of names.filter((n) => /^[a-z0-9-]+\.yaml$/.test(n))) {
      const raw = await readOptional(
        await safePath(project.path, `.clinic/schedules/${name}`),
      );
      if (!raw) continue;
      const config = agentScheduleSchema.parse(parse(raw));
      const scheduleId = name.slice(0, -5);
      const key = `${project.id}:${scheduleId}`;
      const prior = this.runs.store.get<any>("agent-schedule", key);
      const version = hash(raw);
      const runtime =
        prior?.version === version
          ? prior
          : {
              id: key,
              projectId: project.id,
              version,
              nextRunAt: new Date(
                Date.now() + config.intervalHours * 3600000,
              ).toISOString(),
            };
      if (prior?.version !== version)
        this.runs.store.put("agent-schedule", runtime);
      let outcome: string | undefined;
      if (runtime.workflowId) {
        const flow = this.workflows
          .list(project)
          .find((f) => f.id === runtime.workflowId);
        if (flow)
          outcome = flow.error
            ? `Failed: ${flow.error}`
            : `Developer: ${flow.stage.replaceAll("-", " ")}`;
      } else if (runtime.runId) {
        const run = this.runs.get(runtime.runId, project.id);
        outcome = run.error ? `Failed: ${run.error}` : `Run ${run.status}`;
      }
      if (outcome && outcome !== runtime.lastOutcome) {
        runtime.lastOutcome = outcome;
        this.runs.store.put("agent-schedule", runtime);
        const occurrence =
          runtime.occurrenceId &&
          this.runs.store.get<any>("schedule-occurrence", runtime.occurrenceId);
        if (occurrence)
          this.runs.store.put("schedule-occurrence", {
            ...occurrence,
            outcome,
          });
      }
      result.push({
        ...runtime,
        ...config,
        id: scheduleId,
        projectId: project.id,
      });
    }
    return result;
  }
  async save(project: Project, scheduleId: string, input: unknown) {
    safeName(scheduleId);
    const config = agentScheduleSchema.parse(input);
    const agent = (await this.runs.projects.agents(project)).find(
      (a) => a.id === config.agentId,
    );
    assert(agent, "Agent not found in this project.");
    if (agent.role === "qa") {
      assert(config.change?.trim(), "Choose a change for scheduled QA.");
      assert(
        (await this.runs.specs.changes(project)).some(
          (c) => c.name === config.change,
        ),
        "QA target change does not exist in this project.",
      );
    } else assert(config.prompt.trim(), "A saved prompt is required.");
    if (config.enabled && agent.role === "po")
      assert(
        this.runs.store.list<any>("metric", project.id).some((m) => m.reviewed),
        "Review metric mappings before scheduling PO analysis.",
      );
    await atomicWrite(
      await safePath(project.path, `.clinic/schedules/${scheduleId}.yaml`),
      stringify(config),
    );
    if (agent.role === "po") {
      const legacy = this.runs.store.get<any>("schedule", project.id);
      if (legacy?.enabled)
        this.runs.store.put("schedule", { ...legacy, enabled: false });
    }
    return (await this.list(project)).find((s) => s.id === scheduleId)!;
  }
  async tick(startup = false, date = new Date()) {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const project of this.runs.store.list<Project>("project")) {
        let schedules: AgentSchedule[];
        try {
          schedules = await this.list(project);
        } catch {
          continue;
        }
        for (const schedule of schedules) {
          if (
            !schedule.enabled ||
            !schedule.nextRunAt ||
            Date.parse(schedule.nextRunAt) > date.getTime()
          )
            continue;
          const key = `${project.id}:${schedule.id}`;
          const runtime = this.runs.store.require<any>("agent-schedule", key);
          const nextRunAt = new Date(
            date.getTime() + schedule.intervalHours * 3600000,
          ).toISOString();
          this.runs.store.put("agent-schedule", { ...runtime, nextRunAt });
          const record = (
            lastOutcome: string,
            extra: Record<string, unknown> = {},
          ) => {
            this.runs.store.put("agent-schedule", {
              ...this.runs.store.require<any>("agent-schedule", key),
              runId: undefined,
              workflowId: undefined,
              occurrenceId: `${key}:${schedule.nextRunAt}`,
              lastRunAt: date.toISOString(),
              lastOutcome,
              ...extra,
            });
            this.runs.store.put("schedule-occurrence", {
              id: `${key}:${schedule.nextRunAt}`,
              projectId: project.id,
              scheduleId: schedule.id,
              agentId: schedule.agentId,
              prompt: schedule.prompt,
              change: schedule.change,
              dueAt: schedule.nextRunAt,
              at: date.toISOString(),
              outcome: lastOutcome,
              ...extra,
            });
          };
          if (startup) {
            record("Skipped: service was offline", {
              skipped:
                (runtime.skipped ?? 0) +
                Math.floor(
                  (date.getTime() - Date.parse(schedule.nextRunAt)) /
                    (schedule.intervalHours * 3600000),
                ) +
                1,
            });
            continue;
          }
          const busy =
            this.runs.store
              .list<Run>("run", project.id)
              .some(
                (r) =>
                  r.agentId === schedule.agentId &&
                  ["running", "waiting", "queued"].includes(r.status),
              ) ||
            this.workflows
              .list(project)
              .some(
                (f) =>
                  f.agentId === schedule.agentId &&
                  !["review", "failed", "interrupted", "canceled"].includes(
                    f.stage,
                  ),
              );
          if (busy) {
            record("Skipped: agent has active work", {
              skipped: (runtime.skipped ?? 0) + 1,
            });
            continue;
          }
          try {
            const agent = (await this.runs.projects.agents(project)).find(
              (a) => a.id === schedule.agentId,
            );
            assert(agent, "Scheduled agent no longer exists.");
            if (agent.role === "developer") {
              const flow = await this.workflows.start(
                project,
                schedule.prompt,
                agent.id,
              );
              record("Started Developer workflow", { workflowId: flow.id });
            } else {
              if (agent.role === "po")
                assert(
                  this.runs.store
                    .list<any>("metric", project.id)
                    .some((m) => m.reviewed),
                  "Review metric mappings before scheduled analysis.",
                );
              const run =
                agent.role === "po"
                  ? await this.runs.analyze(
                      project,
                      agent.id,
                      false,
                      schedule.prompt,
                    )
                  : agent.role === "qa"
                    ? await this.runs.retryQa(
                        project,
                        schedule.change!,
                        schedule.agentId,
                      )
                    : await this.runs.runCustom(
                        project,
                        agent.id,
                        schedule.prompt,
                      );
              record("Started run", { runId: run.id });
            }
          } catch (error) {
            record(`Failed: ${errorText(error)}`);
          }
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}
