import { DeveloperChat } from "./DeveloperChat.js";
import type { ConnectionProfile } from "../shared/types.js";
import { Modal } from "./Modal.js";
import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Code2,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  AgentDefinition,
  AgentSchedule,
  DeveloperWorkflow,
  EngineConfig,
  Project,
  ProjectConfig,
  Proposal,
  Run,
  SpecFile,
} from "../shared/types.js";
function changeFolder(file: SpecFile) {
  return file.path.match(/^openspec\/changes\/(?:archive\/)?([^/]+)\//)?.[1];
}
export function groupSpecFiles(files: SpecFile[]) {
  const capabilityOf = (file: SpecFile) =>
    file.kind === "spec"
      ? file.path.match(/^openspec\/specs\/(.+)\/[^/]+\.md$/)?.[1]
      : file.path.match(
          /^openspec\/changes\/(?:archive\/)?[^/]+\/specs\/(.+)\/[^/]+\.md$/,
        )?.[1];
  const capabilities = [
    ...new Set(
      files
        .filter((f) => f.kind !== "archive")
        .map(capabilityOf)
        .filter((name): name is string => !!name),
    ),
  ];
  const assigned = new Set<string>();
  const groups = capabilities.sort().map((name) => {
    const related = new Set(
      files
        .filter(
          (f) =>
            ["change", "archive"].includes(f.kind) && capabilityOf(f) === name,
        )
        .map((f) => `${f.kind}:${changeFolder(f)}`),
    );
    const documents = files.filter(
      (f) =>
        (f.kind === "spec" && capabilityOf(f) === name) ||
        related.has(`${f.kind}:${changeFolder(f)}`),
    );
    documents.forEach((f) => assigned.add(f.path));
    return { name, documents };
  });
  const other = files.filter(
    (f) => f.kind === "change" && !assigned.has(f.path),
  );
  for (const change of [...new Set(other.map((f) => f.change))])
    groups.push({
      name: `Change: ${change}`,
      documents: other.filter((f) => f.change === change),
    });
  return groups;
}
function DocumentLinks({
  files,
  onFile,
}: {
  files: SpecFile[];
  onFile(file: SpecFile): void;
}) {
  return (
    <div className="document-links">
      {files.map((file) => (
        <button key={file.path} onClick={() => onFile(file)}>
          <span>{file.path.split("/").at(-1)}</span>
          <small>{file.path.replace(/^openspec\//, "")}</small>
        </button>
      ))}
    </div>
  );
}
interface WorkspaceProps {
  data: {
    project: Project;
    config: ProjectConfig;
    agents: AgentDefinition[];
    files: SpecFile[];
    skills: { name: string; description: string; content: string }[];
    workflows: DeveloperWorkflow[];
    agentSchedules: AgentSchedule[];
    proposals: Proposal[];
    runs: Run[];
    connections: ConnectionProfile[];
  };
  engines: EngineConfig[];
  onSettings(): void;
  onSetup(): void;
  onSetupFiles(): void;
  onConnections(): void;
  onNewAgent(): void;
  onAgent(agent: AgentDefinition): void;
  onDuplicate(agent: AgentDefinition): void;
  onAgentRun(agent: AgentDefinition): void;
  onFile(file: SpecFile): void;
  onProposal(proposal: Proposal): void;
  onRun(run: Run): void;
  onNewChange(): void;
  onRefresh(): void;
  onSend(
    prompt: string,
    agentId: string,
    previousWorkflowId?: string,
  ): Promise<void>;
  onContinue(flow: DeveloperWorkflow, answer?: string): Promise<void>;
  onCancel(flow: DeveloperWorkflow): Promise<void>;
  onSaveSchedule(id: string, value: unknown): Promise<void>;
  onHistory(): void;
  onBacklog(): void;
}
export function ProjectWorkspace(props: WorkspaceProps) {
  const { data } = props;
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [agentId, setAgentId] = useState(
    data.agents.find((a) => a.role === "developer")?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const visibleAgents = data.agents.filter((a) =>
    `${a.name} ${a.role} ${a.instructions}`
      .toLowerCase()
      .includes(agentQuery.toLowerCase()),
  );
  const [schedule, setSchedule] = useState<AgentSchedule | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const perform = async (task: () => Promise<void>) => {
    setSending(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };
  const groups = groupSpecFiles(data.files).filter((g) =>
    `${g.name} ${g.documents.map((f) => `${f.path} ${f.content}`).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const setupRun = data.runs.find((run) => run.kind === "setup-analysis");
  const setupProposal = data.proposals.find(
    (p) => p.id === setupRun?.proposalId,
  );
  return (
    <div className="page project-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PROJECT WORKSPACE</div>
          <h1>{data.project.name}</h1>
          <p className="path">{data.project.path}</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={props.onSetup}>
            Set up SDD
          </button>
          <button className="secondary" onClick={props.onSettings}>
            <Settings2 size={15} /> Project settings
          </button>
        </div>
      </div>
      <section
        className="setup-analysis-panel"
        aria-label="Existing project analysis"
      >
        <div>
          <strong>Code-derived specifications</strong>
          <p>
            {setupRun
              ? `Project analysis ${setupRun.status}. ${setupProposal?.status === "applied" ? "Reviewed baseline saved. Implementation remains unverified." : "Review inferred behavior and file coverage before applying."}`
              : "No project analysis recorded. Set up SDD can derive specifications from existing code and documentation."}
          </p>
        </div>
        <div className="button-row">
          {setupRun && (
            <button className="secondary" onClick={() => props.onRun(setupRun)}>
              View project analysis
            </button>
          )}
          {setupProposal?.status === "pending" && (
            <button
              className="primary"
              onClick={() => props.onProposal(setupProposal)}
            >
              Review setup proposal
            </button>
          )}
          <button className="text-button" onClick={props.onSetupFiles}>
            Install guidance files only
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <DeveloperChat
        data={data}
        engines={props.engines}
        agentId={agentId}
        onAgent={setAgentId}
        composer={composer}
        onConnections={props.onConnections}
        onRefresh={props.onRefresh}
        onFile={props.onFile}
        onProposal={props.onProposal}
        onRun={props.onRun}
        onSend={props.onSend}
        onContinue={props.onContinue}
        onCancel={props.onCancel}
      />
      <section
        id="project-agents"
        className="workspace-section"
        aria-label="Project agents"
      >
        <div className="section-heading">
          <div>
            <h2>Agents</h2>
            <p>Your project’s team, instructions and schedules.</p>
          </div>
          <button className="secondary" onClick={props.onNewAgent}>
            <Plus size={15} />
            Add agent
          </button>
        </div>
        <label className="agent-search">
          <Search size={18} />
          <input
            aria-label="Search agents"
            placeholder="Search agents…"
            value={agentQuery}
            onChange={(e) => setAgentQuery(e.target.value)}
          />
        </label>
        {!visibleAgents.length && (
          <p>
            No matching agents.{" "}
            <button className="text-button" onClick={() => setAgentQuery("")}>
              Clear search
            </button>
          </p>
        )}
        <div className="agent-grid">
          {visibleAgents.map((agent) => {
            const schedules = data.agentSchedules.filter(
              (s) => s.agentId === agent.id,
            );
            return (
              <article
                className={`card agent-card role-${agent.role}`}
                aria-label={`${agent.name} agent`}
                key={agent.id}
              >
                <div className="card-heading">
                  <span className="agent-icon">
                    {agent.role === "developer" ? (
                      <Code2 />
                    ) : agent.role === "qa" ? (
                      <ShieldCheck />
                    ) : agent.role === "po" ? (
                      <Sparkles />
                    ) : (
                      <Bot />
                    )}
                  </span>
                  <span className="stage-label">{agent.role}</span>
                </div>
                <h3>{agent.name}</h3>
                <p>
                  {agent.engine === "project"
                    ? `${data.config.engine} · project default`
                    : agent.engine}{" "}
                  · {agent.model || "default model"}
                </p>
                <p className="muted small">Trigger: {agent.trigger}</p>
                <details className="agent-instructions">
                  <summary>Instructions & limits</summary>
                  <p>{agent.instructions}</p>
                  <p>
                    {agent.timeoutMinutes} minutes · {agent.maxTurns} turns ·{" "}
                    {agent.tools.join(", ")}
                  </p>
                </details>
                <div className="agent-schedules">
                  {schedules.length ? (
                    schedules.map((s) => (
                      <div key={s.id}>
                        <strong>
                          {s.enabled
                            ? `Every ${s.intervalHours} hours`
                            : "Schedule disabled"}
                        </strong>
                        <p>{s.prompt || s.change}</p>
                        {s.enabled && s.nextRunAt && (
                          <small>
                            Next: {new Date(s.nextRunAt).toLocaleString()}
                          </small>
                        )}
                        {s.lastOutcome && <p>{s.lastOutcome}</p>}
                        <button
                          className="text-button"
                          onClick={() => setSchedule(s)}
                        >
                          Edit schedule
                        </button>
                      </div>
                    ))
                  ) : (
                    <p>No schedule configured</p>
                  )}
                  <button
                    className="text-button"
                    onClick={() =>
                      setSchedule({
                        id: `${agent.id}-${Date.now().toString(36)}`,
                        projectId: data.project.id,
                        agentId: agent.id,
                        prompt: "",
                        intervalHours: 24,
                        enabled: false,
                      })
                    }
                  >
                    Add schedule
                  </button>
                </div>
                <div className="card-footer">
                  <button
                    className="secondary"
                    aria-label={`Configure ${agent.name}`}
                    onClick={() => props.onAgent(agent)}
                  >
                    Configure
                  </button>
                  <button
                    className="text-button"
                    aria-label={`Duplicate ${agent.name}`}
                    onClick={() => props.onDuplicate(agent)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (agent.role === "developer") {
                        setAgentId(agent.id);
                        composer.current?.focus();
                        composer.current?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        });
                      } else if (agent.role === "qa")
                        document
                          .getElementById("project-specs")
                          ?.scrollIntoView({ behavior: "smooth" });
                      else props.onAgentRun(agent);
                    }}
                  >
                    {agent.role === "developer"
                      ? "Write prompt"
                      : agent.role === "qa"
                        ? "Review changes"
                        : "Run"}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section
        className="workspace-section project-guidance"
        aria-label="Project guidance"
      >
        <div className="section-heading">
          <div>
            <h2>Project guidance</h2>
            <p>Mission, technology, roadmap and the shared SDD workflow.</p>
          </div>
        </div>
        {data.files.some((f) => f.kind === "project") ? (
          <DocumentLinks
            files={data.files.filter((f) => f.kind === "project")}
            onFile={props.onFile}
          />
        ) : (
          <p>Run Set up SDD to review and add the project documentation kit.</p>
        )}
      </section>
      <section
        className="workspace-section"
        id="project-specs"
        aria-label="Project specifications"
      >
        <div className="section-heading">
          <div>
            <h2>Specifications</h2>
            <p>
              Current requirements and design, with research, validation, tasks
              and the full change history.
            </p>
          </div>
          <button className="secondary" onClick={props.onNewChange}>
            <Plus size={15} />
            New change
          </button>
        </div>
        <label className="agent-search">
          <Search size={18} />
          <input
            aria-label="Search project specs"
            placeholder="Search specs and their Markdown files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="spec-group-grid">
          {groups.map((group) => (
            <details className="card spec-group" key={group.name}>
              <summary>
                <strong>{group.name}</strong>
                <span>{group.documents.length} documents</span>
              </summary>
              {!!group.documents.filter((f) => f.kind === "spec").length && (
                <>
                  <h4>Current documents</h4>
                  <DocumentLinks
                    files={group.documents.filter((f) => f.kind === "spec")}
                    onFile={props.onFile}
                  />
                </>
              )}
              {(["change", "archive"] as const).map((kind) => {
                const documents = group.documents.filter(
                  (f) => f.kind === kind,
                );
                return [...new Set(documents.map(changeFolder))].map(
                  (folder) => (
                    <details
                      className="feature-bundle"
                      key={`${kind}:${folder}`}
                      open={kind === "change"}
                    >
                      <summary>
                        <span>
                          {kind === "change"
                            ? "Proposed change"
                            : "Archived change"}
                        </span>
                        <strong>{folder}</strong>
                        <small>
                          {
                            documents.filter((f) => changeFolder(f) === folder)
                              .length
                          }{" "}
                          documents
                        </small>
                      </summary>
                      <DocumentLinks
                        files={documents.filter(
                          (f) => changeFolder(f) === folder,
                        )}
                        onFile={props.onFile}
                      />
                    </details>
                  ),
                );
              })}
            </details>
          ))}
        </div>
        {!groups.length && (
          <p>
            No matching specification groups. Create a change or clear the
            search.
          </p>
        )}
        {data.files.some((f) => f.kind === "archive") && (
          <details className="card archive-documents">
            <summary>Archived changes</summary>
            <div className="document-links">
              {data.files
                .filter(
                  (f) =>
                    f.kind === "archive" &&
                    `${f.path} ${f.content}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((f) => (
                  <button key={f.path} onClick={() => props.onFile(f)}>
                    {f.path.replace(/^openspec\/changes\/archive\//, "")}
                  </button>
                ))}
            </div>
          </details>
        )}
      </section>
      <section className="workspace-section">
        <details className="card workspace-skills">
          <summary>Project skills · {data.skills.length}</summary>
          {data.skills.map((skill) => (
            <details key={skill.name}>
              <summary>{skill.name}</summary>
              <p>{skill.description}</p>
              <pre>{skill.content}</pre>
            </details>
          ))}
        </details>
        <div className="workspace-utilities">
          <button className="text-button" onClick={props.onConnections}>
            Connect CLI
          </button>
          <button className="text-button" onClick={props.onHistory}>
            Run history
          </button>
          <button className="text-button" onClick={props.onBacklog}>
            Findings & backlog
          </button>
        </div>
      </section>
      {schedule && (
        <Modal title="Agent schedule" onClose={() => setSchedule(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                await props.onSaveSchedule(schedule.id, schedule);
                setSchedule(null);
              });
            }}
          >
            <div className="modal-body form-stack">
              <label>
                Saved task
                <textarea
                  aria-label="Scheduled prompt"
                  value={schedule.prompt}
                  onChange={(e) =>
                    setSchedule({ ...schedule, prompt: e.target.value })
                  }
                />
              </label>
              {data.agents.find((a) => a.id === schedule.agentId)?.role ===
                "qa" && (
                <label>
                  QA target change
                  <input
                    aria-label="QA target change"
                    value={schedule.change ?? ""}
                    onChange={(e) =>
                      setSchedule({ ...schedule, change: e.target.value })
                    }
                  />
                </label>
              )}
              <label>
                Interval in hours
                <input
                  aria-label="Interval hours"
                  type="number"
                  min="1"
                  max="8760"
                  required
                  value={schedule.intervalHours}
                  onChange={(e) =>
                    setSchedule({
                      ...schedule,
                      intervalHours: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={(e) =>
                    setSchedule({ ...schedule, enabled: e.target.checked })
                  }
                />{" "}
                Enable schedule
              </label>
              <p>
                Runs while Clinic is running. Changed specs still require
                review. Missed runs are skipped.
              </p>
              {error && <p role="alert">{error}</p>}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setSchedule(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={sending}>
                Save schedule
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
