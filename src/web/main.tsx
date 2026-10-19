import { ProductSetup } from "./ProductSetup.js";
import { api } from "./api.js";
import { useRun } from "./useRun.js";
import { Modal } from "./Modal.js";
import { ProjectWorkspace } from "./ProjectWorkspace.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  Database,
  FileCode2,
  FileDiff,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Layers3,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type {
  AgentDefinition,
  Approval,
  ChangeRecord,
  ConnectionProfile,
  Conversation,
  EngineConfig,
  EngineKind,
  Evidence,
  Finding,
  ImplementationReview,
  MetricMapping,
  Project,
  ProjectConfig,
  Proposal,
  Run,
  RunEvent,
  Schedule,
  SpecFile,
} from "../shared/types.js";
import "./style.css";

type View =
  | "specs"
  | "projects"
  | "workspace"
  | "skills"
  | "backlog"
  | "runs"
  | "connections";
type ProjectData = {
  project: Project;
  config: ProjectConfig;
  agents: AgentDefinition[];
  workflows: import("../shared/types.js").DeveloperWorkflow[];
  agentSchedules: import("../shared/types.js").AgentSchedule[];
  skills: {
    name: string;
    description: string;
    path: string;
    content: string;
  }[];
  implementation: {
    name: string;
    status: string;
    specHash?: string;
    codeRevision?: string;
  }[];
  files: SpecFile[];
  changes: ChangeRecord[];
  proposals: Proposal[];
  runs: Run[];
  findings: Finding[];
  connections: ConnectionProfile[];
  metrics: MetricMapping[];
  schedule: Schedule;
  conversations: Conversation[];
};
type Action = (task: () => Promise<unknown>) => Promise<void>;
const shortDate = (date: string) =>
  new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const label = (s: string) =>
  s.replaceAll("-", " ").replace(/^./, (c) => c.toUpperCase());
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value}`}>
      <span />
      {label(value)}
    </span>
  );
}
function Empty({
  icon: Icon = FileText,
  title,
  children,
  action,
}: {
  icon?: typeof FileText;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function JsonResult({ value }: { value: unknown }) {
  return <pre className="json-result">{JSON.stringify(value, null, 2)}</pre>;
}

function App() {
  const [state, setState] = useState<{
      projects: (Project & {
        setupStatus: string;
        setupError?: string;
        specCount?: number;
        agentCount?: number;
        skillCount?: number;
      })[];
      engines: EngineConfig[];
      runtime: "docker" | "local";
      version: string;
    } | null>(null),
    [projectId, setProjectId] = useState(
      localStorage.getItem("clinic-project") ?? "",
    ),
    [data, setData] = useState<ProjectData | null>(null),
    [view, setView] = useState<View>("projects");
  const [agentSearch, setAgentSearch] = useState("");
  const selectedProject = useRef(projectId);
  selectedProject.current = projectId;
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [selectedPath, setSelectedPath] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(false),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(""),
    [draftHash, setDraftHash] = useState("");
  const [prompt, setPrompt] = useState(""),
    [chatEngine, setChatEngine] = useState<EngineKind>("codex"),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [proposalFile, setProposalFile] = useState(0);
  const [addProject, setAddProject] = useState(false),
    [delivery, setDelivery] = useState<{
      agentId: string;
      baseline: string;
    } | null>(null),
    [customTask, setCustomTask] = useState<{
      agent: AgentDefinition;
      prompt: string;
    } | null>(null),
    [newChange, setNewChange] = useState(false),
    [settings, setSettings] = useState(false),
    [agentEdit, setAgentEdit] = useState<AgentDefinition | null>(null),
    [metricEdit, setMetricEdit] = useState<Partial<MetricMapping> | null>(null),
    [scheduleEdit, setScheduleEdit] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null),
    [implementation, setImplementation] = useState<ImplementationReview | null>(
      null,
    ),
    [runOpen, setRunOpen] = useState(false),
    [result, setResult] = useState<{ title: string; value: unknown } | null>(
      null,
    ),
    [finding, setFinding] = useState<Finding | null>(null),
    [globalRuns, setGlobalRuns] = useState<Run[]>([]);
  const refresh = useCallback(async () => {
    const next = await api("/state");
    setState(next);
    if (selectedProject.current !== projectId) return;
    if (projectId && next.projects.some((p: Project) => p.id === projectId)) {
      const project = await api<ProjectData>(`/projects/${projectId}`);
      if (selectedProject.current === projectId) setData(project);
    } else {
      setData(null);
      if (next.projects.length) setProjectId(next.projects[0].id);
    }
  }, [projectId]);
  const refreshQuiet = useCallback(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  const runDetail = useRun(activeRunId, refreshQuiet);
  const act: Action = async (task) => {
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void (async () => {
      try {
        const params = new URLSearchParams(location.hash.slice(1));
        const token = params.get("token");
        if (token) {
          await api("/session", { token });
          history.replaceState(null, "", location.pathname);
        }
        await refresh();
        setInitialized(true);
      } catch (e) {
        setError(String((e as Error).message));
      }
    })();
  }, []);
  useEffect(() => {
    if (initialized) void refresh().catch((e) => setError(e.message));
    localStorage.setItem("clinic-project", projectId);
    setSelectedPath("");
    setAgentSearch("");
    setQuery("");
    setPrompt("");
    setEditing(false);
  }, [projectId, initialized]);
  useEffect(() => {
    if (!initialized) return;
    const timer = setInterval(refreshQuiet, 5000);
    return () => clearInterval(timer);
  }, [refreshQuiet, initialized]);
  useEffect(() => {
    if (data && !selectedPath && data.files.length)
      setSelectedPath(
        data.files.find((f) => f.kind === "spec")?.path ?? data.files[0]!.path,
      );
    if (data) setChatEngine(data.config.engine);
  }, [data?.project.id]);
  useEffect(() => {
    if (data && !selectedPath && data.files.length)
      setSelectedPath(
        data.files.find((f) => f.kind === "spec")?.path ?? data.files[0]!.path,
      );
  }, [data?.files.length, selectedPath]);
  useEffect(() => {
    if (view === "runs") setGlobalRuns(data?.runs ?? []);
  }, [view, data?.runs.length, runDetail?.run.status]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const file = data?.files.find((f) => f.path === selectedPath),
    change = data?.changes.find((c) => c.name === file?.change),
    conversation = data?.conversations.find(
      (c) =>
        c.contextPath === selectedPath ||
        (!!file?.change && c.change === file.change),
    ),
    pending =
      data?.proposals.filter(
        (p) =>
          p.status === "pending" &&
          (p.change === file?.change || p.change === conversation?.change),
      ) ?? [];
  const prefix = `/projects/${projectId}`,
    connected = state?.engines.filter((e) => e.connected) ?? [],
    isRunning =
      runDetail &&
      ["running", "waiting", "queued"].includes(runDetail.run.status);
  const openRun = (run: Run) => {
    setActiveRunId(run.id);
    setRunOpen(true);
  };
  const openProposal = (p: Proposal) => {
    setProposal(p);
    setProposalFile(0);
  };
  const shownSetupProposals = useRef(new Set<string>());
  useEffect(() => {
    const run = runDetail?.run;
    if (
      !runOpen ||
      run?.kind !== "setup-analysis" ||
      run.status !== "completed" ||
      run.projectId !== projectId ||
      !run.proposalId ||
      shownSetupProposals.current.has(run.proposalId)
    )
      return;
    const proposed = data?.proposals.find(
      (p) => p.id === run.proposalId && p.status === "pending",
    );
    if (!proposed) return;
    shownSetupProposals.current.add(proposed.id);
    setRunOpen(false);
    setProposal(proposed);
    setProposalFile(0);
  }, [runDetail, runOpen, data, projectId]);
  const startSetup = async (id: string, mode: "auto" | "files" = "auto") => {
    const setup = await api(`/projects/${id}/setup`, { mode });
    if (setup.analysisMessage) setNotice(setup.analysisMessage);
    if (setup.run) {
      setNotice(
        "Analyzing project code and documentation. You can stop the run or return to its progress later.",
      );
      openRun(setup.run);
    } else if (setup.proposal) openProposal(setup.proposal);
    else setNotice(setup.analysisMessage ?? "SDD setup files are up to date.");
  };
  const selectProject = (project: Project) => {
    setProjectId(project.id);
    setView("workspace");
  };
  const showSetup = () => act(() => startSetup(projectId));
  const sendPrompt = () =>
    act(async () => {
      const response = await api(`${prefix}/chat`, {
        prompt,
        path: selectedPath,
        conversationId: conversation?.id,
        engine: chatEngine,
      });
      setActiveRunId(response.run.id);
      setPrompt("");
    });
  const handleChangeAction = (action: string) =>
    act(async () => {
      const response = await api(
        `${prefix}/changes/${change!.name}/${action}`,
        {},
      );
      if (action === "develop" || action === "qa") openRun(response);
      else if (action === "validate")
        setResult({ title: "OpenSpec validation", value: response });
      else
        setNotice(
          action === "approve"
            ? "Specification approved for development."
            : action === "finalize"
              ? "Change finalized. Integrate its branch with your Git workflow."
              : "Integration verified.",
        );
    });
  const nav: { id: View; title: string; icon: typeof FileText }[] = [
    { id: "specs", title: "Specifications", icon: FileText },
    { id: "projects", title: "Projects", icon: FolderOpen },
    { id: "workspace", title: "Project", icon: FolderOpen },
    { id: "skills", title: "Skills", icon: FileText },
    { id: "backlog", title: "Backlog", icon: Layers3 },
    { id: "runs", title: "Runs", icon: Activity },
    { id: "connections", title: "Connections", icon: Plug },
  ];
  const pageTitle = nav.find((n) => n.id === view)!.title;
  if (!initialized)
    return (
      <div className="loading-screen">
        <div className="brand-mark">✳</div>
        <h1>SDD Clinic</h1>
        {error ? (
          <>
            <p>{error}</p>
            <code>sdd-clinic start</code>
            <p>Use the private launch link printed in your terminal.</p>
          </>
        ) : (
          <p>
            <Loader2 className="spin" size={16} /> Connecting to your local
            workspace…
          </p>
        )}
      </div>
    );
  return (
    <div className="app-shell simple-shell">
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="text-button" onClick={() => setView("projects")}>
              SDD Clinic · Projects
            </button>
            {view !== "projects" && data && data.project.id === projectId && (
              <>
                <ChevronRight size={13} />
                <button
                  className="text-button"
                  onClick={() => setView("workspace")}
                >
                  {data.project.name}
                </button>
                {view !== "workspace" && (
                  <>
                    <ChevronRight size={13} />
                    <strong>{pageTitle}</strong>
                  </>
                )}
              </>
            )}
          </div>
          <div className="topbar-actions">
            <span className="local-label">
              <span className="online-dot" /> Local
            </span>
            <button
              className="icon-button"
              title="Refresh workspace"
              aria-label="Refresh workspace"
              onClick={() => void act(refresh)}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
            </button>
            <span className="avatar">SC</span>
          </div>
        </header>
        {error && (
          <div role="alert" className="error-banner">
            <XCircle size={17} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            <CircleCheck size={17} />
            {notice}
          </div>
        )}
        {view !== "projects" && view !== "workspace" && (
          <div className="context-return">
            <button
              className="text-button"
              onClick={() => setView(data ? "workspace" : "projects")}
            >
              ← {data ? "Back to project" : "Back to projects"}
            </button>
          </div>
        )}
        {view === "connections" ? (
          <div className="page connections-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {connected.length
                    ? "WORKSPACE SETTINGS"
                    : "01 / CONNECT YOUR ENGINE"}
                </div>
                <h1>
                  {connected.length
                    ? "Connections"
                    : "A familiar engine. A clearer workflow."}
                </h1>
                <p>
                  {connected.length
                    ? "Choose the coding CLI used by your project agents."
                    : "Connect your installed CLI to start working with specifications."}
                </p>
              </div>
              {!!connected.length && !data && (
                <button className="primary" onClick={() => setAddProject(true)}>
                  Add a project <ArrowRight size={16} />
                </button>
              )}
            </div>
            <div className="engine-grid">
              {state?.engines.map((engine) => (
                <EngineCard
                  key={engine.id}
                  engine={engine}
                  runtime={state?.runtime ?? "local"}
                  busy={busy}
                  act={act}
                  onTest={openRun}
                />
              ))}
            </div>
            {!connected.length && (
              <div className="callout">
                <ShieldCheck size={22} />
                <div>
                  <strong>Runs on your machine, with your CLI</strong>
                  <p>
                    Clinic uses the provider’s supported authentication. Sign in
                    using the Codex sign-in button or the runtime command shown
                    on each card. Docker has its own provider session; signing
                    in on your host does not connect the container.
                  </p>
                </div>
              </div>
            )}
            {!!connected.length && !data && (
              <div className="next-step">
                <div>
                  <span className="eyebrow">NEXT STEP</span>
                  <h2>Give your project a source of truth.</h2>
                  <p>
                    Connect a repository to discover its structure and set up
                    OpenSpec.
                  </p>
                </div>
                <button className="primary" onClick={() => setAddProject(true)}>
                  Add project <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : view === "projects" ? (
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">YOUR WORKSPACE</div>
                <h1>Projects</h1>
                <p>
                  Your global SDD workspace. Set up a repository, then open its
                  specifications, agents and skills.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setView("connections")}
                >
                  Connect CLI
                </button>
                <button className="primary" onClick={() => setAddProject(true)}>
                  <Plus size={16} /> Add project
                </button>
              </div>
            </div>
            <ProductSetup
              engines={state?.engines ?? []}
              onConnect={() => setView("connections")}
              onApplied={(id) => {
                setProjectId(id);
                setView("workspace");
                void refresh();
              }}
            />
            <div className="card-grid">
              {state?.projects.map((p) => (
                <div className="card project-card" key={p.id}>
                  <span className="card-icon">
                    <FolderOpen size={24} />
                  </span>
                  <h2>{p.name}</h2>
                  <p className="path">{p.path}</p>
                  <p>
                    <strong>{p.setupStatus}</strong>
                  </p>
                  {p.setupError ? (
                    <p role="status">{p.setupError}</p>
                  ) : (
                    <p>
                      {p.specCount} specs · {p.agentCount} agents ·{" "}
                      {p.skillCount} skills
                    </p>
                  )}
                  <button
                    className="secondary"
                    onClick={() =>
                      void act(async () => {
                        setProjectId(p.id);
                        await startSetup(p.id);
                      })
                    }
                  >
                    Set up SDD
                  </button>
                  <div className="card-footer">
                    <span className="engine-label">
                      <Terminal size={13} />
                      {p.engine === "codex" ? "Codex" : "Claude"}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => selectProject(p)}
                    >
                      Open workspace <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!state?.projects.length && (
              <Empty
                icon={FolderOpen}
                title="Your next project starts here"
                action={
                  <button
                    className="primary"
                    onClick={() => setAddProject(true)}
                  >
                    Add your first project
                  </button>
                }
              >
                Choose a local repository. Clinic will help turn its behavior
                and future ideas into specs.
              </Empty>
            )}
          </div>
        ) : data?.project.id !== projectId && projectId ? (
          <div className="page" role="status">
            Opening project…
          </div>
        ) : !data ? (
          <Empty
            icon={FolderOpen}
            title="A home for your project’s intent"
            action={
              <button className="primary" onClick={() => setAddProject(true)}>
                <Plus size={16} /> Add project
              </button>
            }
          >
            Connect a local project to browse its specifications, configure
            agents, and build with a shared plan.
          </Empty>
        ) : view === "workspace" ? (
          <ProjectWorkspace
            key={data.project.id}
            data={data}
            engines={state?.engines ?? []}
            onSettings={() => setSettings(true)}
            onSetup={() => void showSetup()}
            onSetupFiles={() => void act(() => startSetup(projectId, "files"))}
            onConnections={() => setView("connections")}
            onNewAgent={() =>
              setAgentEdit({
                id: `custom-${Date.now().toString(36)}`,
                name: "New agent",
                role: "custom",
                engine: "project",
                model: "",
                instructions:
                  "Review this project and report evidence-backed recommendations.",
                tools: ["read"],
                timeoutMinutes: 20,
                maxTurns: 30,
                trigger: "manual",
              })
            }
            onAgent={setAgentEdit}
            onDuplicate={(agent) =>
              setAgentEdit({
                ...agent,
                id: `${agent.id}-${Date.now().toString(36)}`,
                name: `${agent.name} copy`,
              })
            }
            onAgentRun={(agent) => {
              if (agent.role === "po")
                void act(async () =>
                  openRun(
                    await api(`${prefix}/analyze`, { agentId: agent.id }),
                  ),
                );
              else setCustomTask({ agent, prompt: "" });
            }}
            onFile={(file) => {
              setSelectedPath(file.path);
              setSource(false);
              setEditing(false);
              setView("specs");
            }}
            onProposal={openProposal}
            onRun={openRun}
            onNewChange={() => setNewChange(true)}
            onRefresh={refreshQuiet}
            onSend={async (prompt, agentId, previousWorkflowId) => {
              await api(`${prefix}/workflows`, {
                prompt,
                agentId,
                previousWorkflowId,
              });
              await refresh();
            }}
            onContinue={async (flow, answer) => {
              await api(`${prefix}/workflows/${flow.id}/continue`, {
                answer,
                questionId: flow.clarificationId,
              });
              await refresh();
            }}
            onCancel={async (flow) => {
              await api(`${prefix}/workflows/${flow.id}/cancel`, {});
              await refresh();
            }}
            onSaveSchedule={async (id, input) => {
              await api(`${prefix}/agent-schedules/${id}`, input, "PUT");
              await refresh();
            }}
            onHistory={() => setView("runs")}
            onBacklog={() => setView("backlog")}
          />
        ) : view === "specs" ? (
          <div className="spec-page">
            <div className="page-heading spec-heading">
              <div>
                <div className="eyebrow">SPEC-DRIVEN DEVELOPMENT</div>
                <h1>
                  Specifications{" "}
                  <span className="count">{data.files.length}</span>
                </h1>
                <p>Define what matters. Build what’s defined.</p>
              </div>
              <div className="button-row">
                <button className="secondary" onClick={() => setSettings(true)}>
                  <Settings2 size={15} /> Project settings
                </button>
                <button className="primary" onClick={() => setNewChange(true)}>
                  <Plus size={16} /> New change
                </button>
              </div>
            </div>
            <div className="spec-toolbar">
              <div className="tabs">
                {[
                  ["all", "All documents"],
                  ["project", "Project guidance"],
                  ["spec", "Current specs"],
                  ["change", "Proposed"],
                  ["archive", "Archived"],
                ].map(([value, title]) => (
                  <button
                    className={filter === value ? "active" : ""}
                    key={value}
                    onClick={() => setFilter(value!)}
                  >
                    {title}
                    {value !== "all" && (
                      <span>
                        {data.files.filter((f) => f.kind === value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button className="text-button" onClick={showSetup}>
                <Sparkles size={14} /> Set up SDD
              </button>
            </div>
            <div className="spec-layout">
              <section className="spec-list">
                <div className="search-box">
                  <Search size={15} />
                  <input
                    aria-label="Search specifications"
                    placeholder="Find a specification…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="list-caption">
                  PROJECT DOCUMENTS{" "}
                  <span>
                    {
                      data.files.filter(
                        (f) =>
                          (filter === "all" || f.kind === filter) &&
                          `${f.path} ${f.content}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      ).length
                    }
                  </span>
                </div>
                <div className="spec-items">
                  {data.files
                    .filter(
                      (f) =>
                        (filter === "all" || f.kind === filter) &&
                        `${f.path} ${f.content}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    )
                    .map((f) => (
                      <button
                        className={`spec-item ${selectedPath === f.path ? "selected" : ""}`}
                        key={f.path}
                        onClick={() => {
                          setSelectedPath(f.path);
                          setEditing(false);
                          setSource(false);
                        }}
                      >
                        <FileText size={17} />
                        <span>
                          <strong>{f.name || "Specification"}</strong>
                          <small>
                            {f.change ?? f.kind} ·{" "}
                            {data.implementation.find(
                              (i) => i.name === f.change,
                            )?.status ?? "Implementation unknown"}
                          </small>
                        </span>
                        {f.kind === "change" && <span className="draft-dot" />}
                      </button>
                    ))}
                </div>
                <div className="spec-list-footer">
                  <GitBranch size={13} /> Synced with your repository
                </div>
              </section>
              <section className="document-pane">
                {file ? (
                  <>
                    <div className="document-top">
                      <span>
                        <FileText size={14} />
                        {file.path.replace("openspec/", "")}
                      </span>
                      <div className="segmented">
                        <button
                          className={!source && !editing ? "selected" : ""}
                          onClick={() => {
                            setSource(false);
                            setEditing(false);
                          }}
                        >
                          Preview
                        </button>
                        <button
                          className={source ? "selected" : ""}
                          onClick={() => {
                            setSource(true);
                            setEditing(false);
                          }}
                        >
                          Source
                        </button>
                      </div>
                    </div>
                    <div className="document-actions">
                      <div>
                        {change ? (
                          <Badge value={change.state} />
                        ) : (
                          <Badge
                            value={
                              file.kind === "spec"
                                ? "current"
                                : file.kind === "project"
                                  ? "project guidance"
                                  : "archived"
                            }
                          />
                        )}
                        <span className="revision">
                          {file.hash.slice(0, 7)}
                        </span>
                      </div>
                      <div className="button-row">
                        {!editing && file.kind !== "archive" && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setDraft(file.content);
                              setDraftHash(file.hash);
                              setEditing(true);
                              setSource(false);
                            }}
                          >
                            Edit document
                          </button>
                        )}
                        {editing && (
                          <>
                            <button
                              className="text-button"
                              onClick={() => setEditing(false)}
                            >
                              Cancel
                            </button>
                            <button
                              className="secondary small"
                              disabled={busy || draft === file.content}
                              onClick={() =>
                                void act(async () => {
                                  openProposal(
                                    await api(`${prefix}/edit`, {
                                      path: file.path,
                                      content: draft,
                                      baseHash: draftHash,
                                    }),
                                  );
                                  setEditing(false);
                                })
                              }
                            >
                              Review edit
                            </button>
                          </>
                        )}
                        {change?.state === "draft" && (
                          <button
                            className="secondary small"
                            disabled={busy}
                            onClick={() => void handleChangeAction("approve")}
                          >
                            <Check size={14} /> Approve spec
                          </button>
                        )}
                        {change?.state === "ready" && (
                          <button
                            className="primary small"
                            disabled={busy}
                            onClick={() =>
                              setDelivery({
                                agentId:
                                  data.agents.find(
                                    (a) => a.role === "developer",
                                  )?.id ?? "developer",
                                baseline: change.codeRevision ?? "HEAD",
                              })
                            }
                          >
                            <Play size={13} /> Develop
                          </button>
                        )}
                        {change?.state === "review" && (
                          <button
                            className="primary small"
                            onClick={() => void handleChangeAction("finalize")}
                          >
                            Finalize change
                          </button>
                        )}
                        {change?.state === "ready-to-integrate" && (
                          <button
                            className="primary small"
                            onClick={() =>
                              void handleChangeAction("integration")
                            }
                          >
                            Verify integration
                          </button>
                        )}
                      </div>
                    </div>
                    <div
                      className={`document-content ${editing ? "is-editing" : ""}`}
                    >
                      {editing ? (
                        <textarea
                          aria-label="Specification content"
                          className="source-editor"
                          spellCheck={false}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                        />
                      ) : source ? (
                        <pre className="source-view">{file.content}</pre>
                      ) : (
                        <article className="markdown">
                          <Markdown>{file.content}</Markdown>
                        </article>
                      )}
                    </div>
                    {change && (
                      <div className="document-bottom">
                        <span>
                          <GitBranch size={13} />
                          {change.branch ?? "Proposal workspace"}
                        </span>
                        <div className="button-row">
                          <button
                            className="text-button"
                            onClick={() => void handleChangeAction("validate")}
                          >
                            Validate
                          </button>
                          {change.worktree && (
                            <button
                              className="text-button"
                              onClick={() =>
                                void act(async () =>
                                  setImplementation(
                                    await api(
                                      `${prefix}/changes/${change.name}/review`,
                                    ),
                                  ),
                                )
                              }
                            >
                              <FileDiff size={13} /> Review code
                            </button>
                          )}
                          {change.codeRevision && !change.finalRevision && (
                            <button
                              className="text-button"
                              disabled={["developing", "qa"].includes(
                                change.state,
                              )}
                              onClick={() => void handleChangeAction("qa")}
                            >
                              Run QA
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <Empty
                    title="Start with a specification"
                    action={
                      <div className="button-row">
                        <button className="primary" onClick={showSetup}>
                          Set up SDD
                        </button>
                        <button
                          className="secondary"
                          onClick={() => setNewChange(true)}
                        >
                          Create a change
                        </button>
                      </div>
                    }
                  >
                    Describe an idea in the conversation, or set up OpenSpec to
                    define your project’s behavior.
                  </Empty>
                )}
              </section>
              <aside className="chat-pane">
                <div className="chat-heading">
                  <div>
                    <span className="sparkle-icon">
                      <Sparkles size={17} />
                    </span>
                    <strong>Spec assistant</strong>
                  </div>
                  <span className="small muted">PROMPT TO EDIT</span>
                </div>
                <div className="chat-context">
                  <FileText size={13} />
                  <span>{file?.name ?? data.project.name}</span>
                  <span>Attached</span>
                </div>
                <div className="chat-messages">
                  {!conversation?.messages.length && (
                    <div className="chat-intro">
                      <div className="assistant-symbol">✳</div>
                      <h3>Make your intent explicit.</h3>
                      <p>
                        Ask a question or describe a change. We’ll turn it into
                        a proposal you can review.
                      </p>
                      <button
                        onClick={() =>
                          setPrompt(
                            "Review this specification for missing requirements and edge cases. Propose concrete acceptance scenarios.",
                          )
                        }
                      >
                        Find gaps & edge cases <ArrowUpRight size={13} />
                      </button>
                      <button
                        onClick={() =>
                          setPrompt(
                            file
                              ? "Help me refine this specification and its acceptance scenarios."
                              : "Inspect this project and propose baseline specifications. Label inferred behavior for review.",
                          )
                        }
                      >
                        {file
                          ? "Refine this specification"
                          : "Discover project behavior"}{" "}
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
                  {conversation?.messages.map((message, i) => (
                    <div className={`message message-${message.role}`} key={i}>
                      <span className="message-label">
                        {message.role === "user" ? "You" : "Clinic"}
                        <small>{shortDate(message.at)}</small>
                      </span>
                      <Markdown>{message.text}</Markdown>
                    </div>
                  ))}
                  {isRunning &&
                    runDetail?.run.conversationId === conversation?.id && (
                      <div className="run-indicator">
                        <Loader2 size={15} className="spin" />
                        <span>
                          {runDetail.run.status === "waiting"
                            ? "Waiting for your input"
                            : "Working through your specification…"}
                        </span>
                        <button onClick={() => setRunOpen(true)}>View</button>
                      </div>
                    )}
                  {pending.map((p) => (
                    <div className="proposal-card" key={p.id}>
                      <span>
                        <FileDiff size={17} />
                        {p.files.length} file{p.files.length === 1 ? "" : "s"}{" "}
                        proposed
                      </span>
                      <p>{p.title}</p>
                      <button
                        className="secondary"
                        onClick={() => openProposal(p)}
                      >
                        Review changes <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="composer">
                  <textarea
                    aria-label="Prompt"
                    placeholder="Describe what you want to change…"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        (e.metaKey || e.ctrlKey) &&
                        e.key === "Enter" &&
                        prompt.trim() &&
                        !busy
                      ) {
                        e.preventDefault();
                        void sendPrompt();
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <select
                      aria-label="Chat engine"
                      value={chatEngine}
                      onChange={(e) =>
                        setChatEngine(e.target.value as EngineKind)
                      }
                    >
                      {connected.map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.id === "codex" ? "Codex CLI" : "Claude CLI"}
                        </option>
                      ))}
                    </select>
                    <button
                      className="send-button"
                      disabled={
                        !prompt.trim() ||
                        busy ||
                        !!(isRunning && runDetail?.run.kind === "chat")
                      }
                      aria-label="Send prompt"
                      onClick={() => void sendPrompt()}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </div>
                <p className="composer-hint">
                  <ShieldCheck size={12} /> Changes stay proposals until you
                  apply them.
                </p>
              </aside>
            </div>
          </div>
        ) : view === "skills" ? (
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">{data.project.name}</div>
                <h1>Skills</h1>
                <p>
                  Project-local instructions for creating and implementing
                  specifications. Edit the repository files to customize them.
                </p>
              </div>
            </div>
            {!data.skills.length && (
              <p>
                No skills installed. Use project setup to review and install the
                defaults.
              </p>
            )}
            {data.skills.map((skill) => (
              <section className="card" key={skill.path}>
                <h2>{skill.name}</h2>
                <p>{skill.description}</p>
                <code>{skill.path}</code>
                <details>
                  <summary>View skill instructions</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{skill.content}</pre>
                </details>
              </section>
            ))}
          </div>
        ) : view === "backlog" ? (
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">EVIDENCE INTO ACTION</div>
                <h1>Product backlog</h1>
                <p>
                  Findings grounded in your features, specifications, and data.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setScheduleEdit(true)}
                >
                  <Clock3 size={15} />{" "}
                  {data.schedule.enabled ? "Schedule enabled" : "Schedule"}
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    void act(async () =>
                      openRun(await api(`${prefix}/analyze`, {})),
                    )
                  }
                >
                  <Sparkles size={16} /> Run PO analysis
                </button>
              </div>
            </div>
            <div className="stat-strip">
              {[
                [
                  "Needs triage",
                  data.findings.filter((f) => f.status === "triage").length,
                ],
                [
                  "Ready to plan",
                  data.findings.filter((f) => f.status === "ready").length,
                ],
                ["Connected sources", data.connections.length],
                [
                  "Reviewed metrics",
                  data.metrics.filter((m) => m.reviewed).length,
                ],
              ].map(([title, value]) => (
                <div key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="section-heading">
              <div>
                <h2>Feature metrics</h2>
                <p>
                  Review the relationship between your features and data before
                  recurring analysis.
                </p>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={!data.connections.length}
                  onClick={() =>
                    void act(async () =>
                      openRun(
                        await api(`${prefix}/analyze`, {
                          suggestMappings: true,
                        }),
                      ),
                    )
                  }
                >
                  <Sparkles size={15} /> Suggest metrics
                </button>
                <button className="secondary" onClick={() => setMetricEdit({})}>
                  <Plus size={16} /> Add metric
                </button>
              </div>
            </div>
            <div className="stack">
              {data.metrics.map((metric) => (
                <div className="list-card" key={metric.id}>
                  <div>
                    <strong>{metric.name}</strong>
                    <p>
                      {metric.feature} · {metric.period}
                    </p>
                  </div>
                  <Badge value={metric.reviewed ? "reviewed" : "draft"} />
                  <button
                    className="secondary small"
                    onClick={() => setMetricEdit(metric)}
                  >
                    Review mapping
                  </button>
                </div>
              ))}
            </div>

            {data.findings.length ? (
              <div className="stack">
                {data.findings.map((f) => (
                  <button
                    className="finding-card"
                    key={f.id}
                    onClick={() => setFinding(f)}
                  >
                    <span className={`priority-dot priority-${f.priority}`} />
                    <div>
                      <div className="finding-meta">
                        <span>{label(f.kind)}</span>
                        <span>·</span>
                        <span>{f.feature}</span>
                      </div>
                      <h3>{f.title}</h3>
                      <p>{f.observed}</p>
                    </div>
                    <Badge value={f.status} />
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                icon={Sparkles}
                title="Good decisions start with evidence"
                action={
                  <button
                    className="secondary"
                    onClick={() => setView("workspace")}
                  >
                    Open project chat <ArrowRight size={15} />
                  </button>
                }
              >
                Your PO agent turns read-only data and server evidence into
                improvements, investigations, and bugs. Findings will appear
                here after analysis.
              </Empty>
            )}
          </div>
        ) : (
          <div className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">OBSERVABLE BY DEFAULT</div>
                <h1>Agent runs</h1>
                <p>
                  Follow each action from the approved spec to its evidence.
                </p>
              </div>
              <button
                className="secondary"
                onClick={() =>
                  void act(async () =>
                    setGlobalRuns((await api(`/projects/${projectId}`)).runs),
                  )
                }
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
            {globalRuns.filter((r) => r.projectId === projectId || !r.projectId)
              .length ? (
              <div className="run-table">
                <div className="run-table-header">
                  <span>Run</span>
                  <span>Status</span>
                  <span>Engine</span>
                  <span>Started</span>
                </div>
                {globalRuns
                  .filter((r) => r.projectId === projectId || !r.projectId)
                  .map((r) => (
                    <button
                      className="run-table-row"
                      key={r.id}
                      onClick={() => openRun(r)}
                    >
                      <span>
                        <span className="run-icon">
                          <Activity size={18} />
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>
                            {r.kind}{" "}
                            {r.codeRevision
                              ? `· ${r.codeRevision.slice(0, 8)}`
                              : ""}
                          </small>
                        </span>
                      </span>
                      <Badge value={r.status} />
                      <span className="muted">{label(r.engine)}</span>
                      <span className="muted small">
                        {shortDate(r.startedAt)}
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <Empty icon={Activity} title="Every run leaves a trail">
                Start a spec conversation, implementation, or PO analysis. Its
                progress and results will be recorded here.
              </Empty>
            )}
          </div>
        )}
      </main>
      {implementation && (
        <Modal
          title="Implementation review"
          wide
          onClose={() => setImplementation(null)}
        >
          <div className="modal-body">
            <div className="button-row">
              <Badge
                value={implementation.qaCurrent ? "passed" : "unverified"}
              />
              <span>
                {implementation.qaCurrent
                  ? "QA matches this revision"
                  : "Run QA before accepting this revision"}
              </span>
            </div>
            <div className="workspace-path">
              <strong>Branch</strong>
              <code>{implementation.branch}</code>
              <strong>Commit</strong>
              <code>{implementation.codeRevision}</code>
              <strong>Workspace</strong>
              <code>{implementation.worktree}</code>
            </div>
            <pre className="source-view">{implementation.files}</pre>
            {implementation.uncommitted && (
              <div className="callout">
                <p>
                  Uncommitted implementation edits require review before QA.
                </p>
                <pre>{implementation.uncommitted}</pre>
              </div>
            )}
            <div className="diff-content">
              <pre>
                {implementation.diff.split("\n").map((line, index) => (
                  <div
                    key={index}
                    className={
                      line.startsWith("+")
                        ? "added"
                        : line.startsWith("-")
                          ? "removed"
                          : line.startsWith("@@")
                            ? "hunk"
                            : ""
                    }
                  >
                    {line || " "}
                  </div>
                ))}
              </pre>
            </div>
            <p className="muted small">
              Integrate this branch through your existing Git workflow after
              finalizing the change.
            </p>
          </div>
        </Modal>
      )}
      {customTask && (
        <Modal
          title={`Run ${customTask.agent.name}`}
          onClose={() => setCustomTask(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const run = await api(
                  `${prefix}/agents/${customTask.agent.id}/run`,
                  { prompt: customTask.prompt },
                );
                setCustomTask(null);
                openRun(run);
              });
            }}
          >
            <div className="modal-body form-stack">
              <p>
                Custom agents inspect your project and produce a read-only
                report.
              </p>
              <Field label="Task prompt">
                <textarea
                  required
                  rows={5}
                  value={customTask.prompt}
                  onChange={(e) =>
                    setCustomTask({ ...customTask, prompt: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="modal-footer">
              <button className="primary" disabled={busy}>
                Start agent
              </button>
            </div>
          </form>
        </Modal>
      )}
      {delivery && data && change && (
        <Modal
          title={`Develop ${change.name}`}
          onClose={() => setDelivery(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const run = await api(
                  `${prefix}/changes/${change.name}/develop`,
                  delivery,
                );
                setDelivery(null);
                openRun(run);
              });
            }}
          >
            <div className="modal-body form-stack">
              <p>
                Choose a committed baseline. Clinic creates a dedicated branch
                and copies the approved specification into its worktree.
              </p>
              <Field label="Developer agent">
                <select
                  value={delivery.agentId}
                  onChange={(e) =>
                    setDelivery({ ...delivery, agentId: e.target.value })
                  }
                >
                  {data.agents
                    .filter((a) => a.role === "developer")
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Committed baseline">
                <input
                  required
                  value={delivery.baseline}
                  onChange={(e) =>
                    setDelivery({ ...delivery, baseline: e.target.value })
                  }
                  placeholder="HEAD, main, or commit SHA"
                />
              </Field>
              <p className="muted small">
                QA starts automatically after implementation. Uncommitted work
                stays in your current checkout.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="secondary"
                onClick={() => setDelivery(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Start development
              </button>
            </div>
          </form>
        </Modal>
      )}
      {addProject && (
        <ProjectModal
          engines={
            state?.engines.length
              ? state.engines
              : [
                  { id: "codex", path: "codex", connected: false },
                  { id: "claude", path: "claude", connected: false },
                ]
          }
          busy={busy}
          onClose={() => setAddProject(false)}
          onSave={(input, mode) =>
            void act(async () => {
              const p = await api<Project>("/projects", input);
              setProjectId(p.id);
              setAddProject(false);
              setView("workspace");
              await startSetup(p.id, mode);
            })
          }
        />
      )}
      {newChange && (
        <ChangeModal
          busy={busy}
          capabilities={
            data?.files
              .filter((f) => f.kind === "spec" && f.path.endsWith("/spec.md"))
              .map((f) => f.path.split("/")[2]!) ?? []
          }
          onClose={() => setNewChange(false)}
          onSave={(input) =>
            void act(async () => {
              const c = await api(`${prefix}/changes`, input);
              setSelectedPath(`openspec/changes/${c.name}/proposal.md`);
              setFilter("change");
              setNewChange(false);
              setView("specs");
              openProposal(c.proposal);
            })
          }
        />
      )}
      {settings && data && (
        <ConfigModal
          config={data.config}
          busy={busy}
          onClose={() => setSettings(false)}
          onSave={(config) =>
            void act(async () => {
              await api(`${prefix}/config`, config, "PUT");
              setSettings(false);
            })
          }
        />
      )}
      {agentEdit && (
        <AgentModal
          agent={agentEdit}
          busy={busy}
          onClose={() => setAgentEdit(null)}
          onSave={(agent) =>
            void act(async () => {
              await api(`${prefix}/agents`, agent);
              setAgentEdit(null);
            })
          }
        />
      )}
      {metricEdit && data && (
        <MetricModal
          metric={metricEdit}
          connections={data.connections}
          busy={busy}
          onClose={() => setMetricEdit(null)}
          onSave={(metric) =>
            void act(async () => {
              await api(`${prefix}/metrics`, metric);
              setMetricEdit(null);
            })
          }
        />
      )}
      {scheduleEdit && data && (
        <ScheduleModal
          schedule={data.schedule}
          busy={busy}
          onClose={() => setScheduleEdit(false)}
          onSave={(schedule) =>
            void act(async () => {
              await api(`${prefix}/schedule`, schedule, "PUT");
              setScheduleEdit(false);
            })
          }
        />
      )}
      {proposal && (
        <Modal
          title="Review proposed changes"
          wide
          onClose={() => setProposal(null)}
        >
          <div className="proposal-summary">
            <FileDiff size={20} />
            <div>
              <strong>{proposal.title}</strong>
              <p>
                {proposal.files.length} files ·{" "}
                {proposal.source === "setup" || proposal.source === "baseline"
                  ? "Project setup"
                  : "Specification change"}{" "}
                · Nothing changes until you apply.
              </p>
            </div>
          </div>
          {proposal.source === "baseline" && (
            <p className="baseline-review-note">
              These specs are inferred from project code and documentation.
              Review baseline-analysis.md for file coverage, exclusions and
              contradictions. Applying them does not verify implementation or
              tests.
            </p>
          )}
          {proposal.source === "setup" && (
            <p className="baseline-review-note">
              Guidance files only. Code-derived specifications have not been
              generated. Connect the project's CLI and run Set up SDD to analyze
              existing behavior.
            </p>
          )}
          <div className="diff-layout">
            <nav>
              {proposal.files.map((f, i) => (
                <button
                  className={i === proposalFile ? "active" : ""}
                  key={f.path}
                  onClick={() => setProposalFile(i)}
                >
                  <FileText size={14} />
                  <span>{f.path}</span>
                  {f.before === null && <b>NEW</b>}
                </button>
              ))}
            </nav>
            <div className="diff-content">
              <div className="diff-filename">
                {proposal.files[proposalFile]?.path}
              </div>
              <pre>
                {proposal.files[proposalFile]?.diff
                  .split("\n")
                  .map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.startsWith("+")
                          ? "added"
                          : line.startsWith("-")
                            ? "removed"
                            : line.startsWith("@@")
                              ? "hunk"
                              : ""
                      }
                    >
                      <span className="line-number">{i + 1}</span>
                      {line || " "}
                    </div>
                  ))}
              </pre>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api(
                    `/projects/${proposal.projectId}/proposals/${proposal.id}/reject`,
                    {},
                  );
                  setProposal(null);
                })
              }
            >
              Discard proposal
            </button>
            <div className="button-row">
              <button className="secondary" onClick={() => setProposal(null)}>
                Keep reviewing
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api(
                      `/projects/${proposal.projectId}/proposals/${proposal.id}/apply`,
                      {},
                    );
                    setNotice("Changes applied to your repository.");
                    if (proposal.change)
                      setSelectedPath(
                        proposal.files.find((f) =>
                          f.path.endsWith("proposal.md"),
                        )?.path ?? proposal.files[0]!.path,
                      );
                    setProposal(null);
                  })
                }
              >
                <CheckCheck size={16} /> Apply {proposal.files.length} file
                {proposal.files.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {runOpen && activeRunId && (
        <Modal
          title={runDetail?.run.title ?? "Agent run"}
          wide
          onClose={() => setRunOpen(false)}
        >
          {runDetail ? (
            <RunInspector
              detail={runDetail}
              act={act}
              onCancel={() =>
                void act(async () => api(`/runs/${activeRunId}/cancel`, {}))
              }
              onAnswer={(approval, approved, answer) =>
                void act(async () =>
                  api(`/runs/${activeRunId}/approvals/${approval.id}`, {
                    approved,
                    answer,
                  }),
                )
              }
            />
          ) : (
            <div className="modal-body">Loading run…</div>
          )}
        </Modal>
      )}
      {result && (
        <Modal title={result.title} wide onClose={() => setResult(null)}>
          <div className="modal-body">
            {(result.value as any)?.connection ? (
              <ConnectionExplorer
                connection={(result.value as any).connection}
                prefix={prefix}
                act={act}
              />
            ) : (
              <JsonResult value={result.value} />
            )}
          </div>
        </Modal>
      )}
      {finding && (
        <Modal title={finding.title} wide onClose={() => setFinding(null)}>
          <div className="modal-body">
            <div className="button-row">
              <Badge value={finding.kind} />
              <Badge value={finding.status} />
              <span className="muted">
                {finding.feature} · {finding.period}
              </span>
            </div>
            {[
              ["Observed", finding.observed],
              ["Expected", finding.expected],
              ["Uncertainty", finding.uncertainty],
              ["Suggested action", finding.action],
              ["Priority rationale", finding.rationale],
            ].map(([title, value]) => (
              <section className="finding-section" key={title}>
                <h3>{title}</h3>
                <p>{value}</p>
              </section>
            ))}
            <h3>Evidence</h3>
            <p className="muted small">
              Sample size: {finding.sampleSize ?? "not established"} ·
              Denominator: {finding.denominator ?? "not established"}
            </p>
            <Field label="Priority">
              <select
                value={finding.priority}
                onChange={(e) =>
                  void act(async () =>
                    setFinding(
                      await api(
                        `${prefix}/findings/${finding.id}`,
                        { priority: e.target.value },
                        "PATCH",
                      ),
                    ),
                  )
                }
              >
                {["low", "medium", "high"].map((priority) => (
                  <option key={priority} value={priority}>
                    {label(priority)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="button-row">
              {finding.evidenceIds.map((e) => (
                <button
                  className="secondary small"
                  key={e}
                  onClick={() =>
                    void act(async () =>
                      setResult({
                        title: "Finding evidence",
                        value: await api(`${prefix}/evidence/${e}`),
                      }),
                    )
                  }
                >
                  <Database size={14} /> {e.slice(0, 8)}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <div className="button-row">
              <button
                className="text-button"
                onClick={() =>
                  void act(async () => {
                    await api(
                      `${prefix}/findings/${finding.id}`,
                      { status: "dismissed" },
                      "PATCH",
                    );
                    setFinding(null);
                  })
                }
              >
                Dismiss
              </button>
              <button
                className="secondary"
                onClick={() =>
                  void act(async () => {
                    await api(
                      `${prefix}/findings/${finding.id}`,
                      { status: "ready" },
                      "PATCH",
                    );
                    setFinding(null);
                  })
                }
              >
                Mark ready
              </button>
            </div>
            <button
              className="primary"
              disabled={!!finding.change || busy}
              onClick={() =>
                void act(async () => {
                  const response = await api(
                    `${prefix}/findings/${finding.id}/convert`,
                    {},
                  );
                  setFinding(null);
                  setView("specs");
                  setSelectedPath(
                    `openspec/changes/${response.name}/proposal.md`,
                  );
                })
              }
            >
              Create spec change <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EngineCard({
  engine,
  runtime,
  busy,
  act,
  onTest,
}: {
  engine: EngineConfig;
  runtime: "docker" | "local";
  busy: boolean;
  act: Action;
  onTest: (run: Run) => void;
}) {
  const [path, setPath] = useState(engine.path);
  const [login, setLogin] = useState<
    import("../shared/types.js").EngineLoginStatus
  >(engine.login ?? { status: "idle" });
  const [pollError, setPollError] = useState("");
  const signingIn = ["starting", "waiting"].includes(login.status);
  const terminalCommand = `${runtime === "docker" ? "docker compose exec clinic " : ""}${engine.id === "codex" ? "codex login --device-auth" : "claude auth login"}`;
  useEffect(() => {
    if (!signingIn) return;
    let closed = false;
    const timer = setInterval(() => {
      void api(`/engines/${engine.id}/login`)
        .then((next) => {
          if (closed) return;
          setLogin(next);
          setPollError("");
          if (!["starting", "waiting"].includes(next.status))
            void act(async () => {});
        })
        .catch((e) => {
          if (!closed) setPollError(e.message);
        });
    }, 1000);
    return () => {
      closed = true;
      clearInterval(timer);
    };
  }, [signingIn, engine.id]);
  return (
    <div
      className={`card engine-card ${engine.connected ? "is-connected" : ""}`}
    >
      <div className="card-heading">
        <span className={`engine-logo ${engine.id}`}>
          {engine.id === "codex" ? <Terminal size={28} /> : <span>✳</span>}
        </span>
        <Badge
          value={
            engine.connected
              ? "connected"
              : signingIn
                ? "signing-in"
                : "not-connected"
          }
        />
      </div>
      <h2>{engine.id === "codex" ? "Codex CLI" : "Claude CLI"}</h2>
      <p>
        {runtime === "docker"
          ? "Runs inside Clinic’s Docker container."
          : "Runs in Clinic’s local environment."}{" "}
        {engine.id === "codex"
          ? "Sign in with your ChatGPT account below."
          : "Use the supported Claude CLI sign-in."}
      </p>
      <Field label="Executable">
        <input
          value={path}
          disabled={signingIn}
          onChange={(e) => setPath(e.target.value)}
          placeholder={engine.id}
        />
      </Field>
      {engine.probe && (
        <div className="probe-result">
          <span>{engine.probe.version ?? "Not detected"}</span>
          <p>{engine.probe.detail}</p>
        </div>
      )}
      {signingIn && (
        <section
          className="login-challenge"
          aria-label="Codex sign-in"
          aria-live="polite"
        >
          <strong>
            {login.status === "starting"
              ? "Preparing secure sign-in…"
              : "Finish signing in with ChatGPT"}
          </strong>
          {login.userCode && (
            <>
              <p>Open the provider page and enter this one-time code:</p>
              <code className="device-code">{login.userCode}</code>
              <a
                className="primary"
                href={login.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open sign-in page <ArrowUpRight size={15} />
              </a>
              <p>Waiting for authorization. This card updates automatically.</p>
            </>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void act(async () =>
                setLogin(await api(`/engines/${engine.id}/login/cancel`, {})),
              )
            }
          >
            Cancel sign-in
          </button>
        </section>
      )}
      {(login.error || pollError) && (
        <p className="error-banner" role="alert">
          {login.error || pollError} Device login may need to be enabled in your
          ChatGPT security or workspace settings.
        </p>
      )}
      {login.status === "canceled" && (
        <p role="status">Sign-in canceled. You can start again.</p>
      )}
      {!engine.connected && !signingIn && (
        <div className="login-help">
          <p>
            {runtime === "docker"
              ? "Your host sign-in is separate. Terminal alternative, from the Clinic folder:"
              : "Terminal alternative:"}
          </p>
          <code>{terminalCommand}</code>
        </div>
      )}
      <div className="card-footer">
        {!engine.connected && engine.id === "codex" && (
          <button
            className="primary"
            disabled={busy || signingIn || !path.trim()}
            onClick={() =>
              void act(async () => {
                setPollError("");
                setLogin(await api(`/engines/${engine.id}/login`, { path }));
              })
            }
          >
            Sign in with ChatGPT
          </button>
        )}
        <button
          className={
            engine.id === "codex" && !engine.connected ? "secondary" : "primary"
          }
          disabled={busy || signingIn}
          onClick={() =>
            void act(async () => api(`/engines/${engine.id}/connect`, { path }))
          }
        >
          <RefreshCw size={14} />
          {engine.connected ? "Check connection" : "Check & connect"}
        </button>
        <button
          className="text-button"
          disabled={!engine.connected || busy}
          onClick={() =>
            void act(async () =>
              onTest(await api(`/engines/${engine.id}/test`, {})),
            )
          }
        >
          Test conversation <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
function ProjectModal({
  engines,
  busy,
  onClose,
  onSave,
}: {
  engines: EngineConfig[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: unknown, mode: "auto" | "files") => void;
}) {
  const [path, setPath] = useState(""),
    [name, setName] = useState(""),
    [engine, setEngine] = useState(engines[0]?.id ?? "codex"),
    [analyze, setAnalyze] = useState(true);
  return (
    <Modal title="Add a project" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(
            { path, name: name || undefined, engine },
            analyze ? "auto" : "files",
          );
        }}
      >
        <div className="modal-body">
          <p className="form-intro">
            Clinic reads existing source, tests and documentation to propose
            capability specs and agent guidance for review. Source-derived specs
            require a connected CLI.
          </p>
          <Field
            label="Project directory"
            hint="Path inside Docker, such as /projects/my-app. Only repositories mounted into Clinic are accessible. Provider sign-in is optional for setup."
          >
            <input
              required
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/projects/my-app"
            />
          </Field>
          <Field
            label="Project name"
            hint="Optional. Defaults to the folder name."
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My project"
            />
          </Field>
          <Field label="Default engine">
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as EngineKind)}
            >
              {engines.map((en) => (
                <option key={en.id} value={en.id}>
                  {label(en.id)} CLI
                </option>
              ))}
            </select>
          </Field>
          <label className="setup-analysis-choice">
            <input
              type="checkbox"
              checked={analyze}
              onChange={(e) => setAnalyze(e.target.checked)}
            />{" "}
            Analyze existing code and documentation
          </label>
          <p className="muted small">
            Without a connected CLI, setup installs guidance files only. You can
            run analysis later with Set up SDD.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !path.trim()}>
            Inspect & set up <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ChangeModal({
  busy,
  capabilities,
  onClose,
  onSave,
}: {
  busy: boolean;
  capabilities: string[];
  onClose: () => void;
  onSave: (input: unknown) => void;
}) {
  const [title, setTitle] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [capability, setCapability] = useState("");
  return (
    <Modal title="Start a proposed change" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ title, name, description, capability: capability || name });
        }}
      >
        <div className="modal-body">
          <p className="form-intro">
            Review a complete draft folder: research, proposal, requirements,
            design, validation and tasks. Refine it with your assistant before
            approval.
          </p>
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setName(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }}
              placeholder="Add passwordless sign-in"
            />
          </Field>
          <Field label="Change identifier">
            <input
              required
              pattern="[a-z0-9][a-z0-9-]*"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Affected capability">
            <select
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
            >
              <option value="">New capability (uses change identifier)</option>
              {capabilities.map((name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Why is this change needed?">
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem and the outcome you want."
            />
          </Field>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Create proposal <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ConfigModal({
  config,
  busy,
  onClose,
  onSave,
}: {
  config: ProjectConfig;
  busy: boolean;
  onClose: () => void;
  onSave: (config: unknown) => void;
}) {
  const [value, setValue] = useState(config),
    [commands, setCommands] = useState(
      JSON.stringify(config.commands, null, 2),
    ),
    [error, setError] = useState("");
  return (
    <Modal title="Project settings" wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            onSave({ ...value, commands: JSON.parse(commands) });
          } catch {
            setError("Commands must be valid JSON.");
          }
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Name">
              <input
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
              />
            </Field>
            <Field label="Target branch">
              <input
                value={value.targetBranch}
                onChange={(e) =>
                  setValue({ ...value, targetBranch: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Project context">
            <textarea
              rows={4}
              value={value.context}
              onChange={(e) => setValue({ ...value, context: e.target.value })}
            />
          </Field>
          <Field label="Default engine">
            <select
              value={value.engine}
              onChange={(e) =>
                setValue({ ...value, engine: e.target.value as EngineKind })
              }
            >
              <option value="codex">Codex CLI</option>
              <option value="claude">Claude CLI</option>
            </select>
          </Field>
          <Field
            label="Setup and check commands"
            hint={
              "JSON array: {name, command, args, cwd, phase}. Phase is setup or check. Commands run in isolated workspaces without a shell."
            }
          >
            <textarea
              className="code-input"
              rows={12}
              value={commands}
              onChange={(e) => setCommands(e.target.value)}
            />
          </Field>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save settings
          </button>
        </div>
      </form>
    </Modal>
  );
}
function AgentModal({
  agent,
  busy,
  onClose,
  onSave,
}: {
  agent: AgentDefinition;
  busy: boolean;
  onClose: () => void;
  onSave: (agent: AgentDefinition) => void;
}) {
  const [value, setValue] = useState(agent);
  return (
    <Modal title={`Configure ${agent.name}`} wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Name">
              <input
                required
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
              />
            </Field>
            <Field label="Identifier">
              <input
                required
                pattern="[a-z0-9-]+"
                value={value.id}
                onChange={(e) => setValue({ ...value, id: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <select
                value={value.role}
                onChange={(e) =>
                  setValue({
                    ...value,
                    role: e.target.value as AgentDefinition["role"],
                  })
                }
              >
                {["developer", "qa", "po", "custom"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Engine">
              <select
                value={value.engine}
                onChange={(e) =>
                  setValue({
                    ...value,
                    engine: e.target.value as AgentDefinition["engine"],
                  })
                }
              >
                <option value="project">Project default</option>
                <option value="codex">Codex CLI</option>
                <option value="claude">Claude CLI</option>
              </select>
            </Field>
          </div>
          <Field label="Instructions">
            <textarea
              rows={7}
              required
              value={value.instructions}
              onChange={(e) =>
                setValue({ ...value, instructions: e.target.value })
              }
            />
          </Field>
          <Field
            label="Model"
            hint="Leave blank to use the CLI’s configured model."
          >
            <input
              value={value.model}
              onChange={(e) => setValue({ ...value, model: e.target.value })}
              placeholder="Provider default"
            />
          </Field>
          <div className="form-grid">
            <Field label="Time limit (minutes)">
              <input
                type="number"
                min={1}
                max={240}
                value={value.timeoutMinutes}
                onChange={(e) =>
                  setValue({ ...value, timeoutMinutes: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Turn / tool-step limit">
              <input
                type="number"
                min={1}
                max={200}
                value={value.maxTurns}
                onChange={(e) =>
                  setValue({ ...value, maxTurns: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="Trigger">
            <select
              value={value.trigger}
              onChange={(e) =>
                setValue({
                  ...value,
                  trigger: e.target.value as AgentDefinition["trigger"],
                })
              }
            >
              <option value="manual">Manual</option>
              <option value="after-development">After development</option>
              <option value="schedule">Schedule</option>
            </select>
          </Field>
          <div className="tool-options">
            {(["read", "edit", "command", "data"] as const).map((tool) => (
              <label key={tool}>
                <input
                  type="checkbox"
                  checked={value.tools.includes(tool)}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      tools: e.target.checked
                        ? [...value.tools, tool]
                        : value.tools.filter((t) => t !== tool),
                    })
                  }
                />
                {label(tool)}
              </label>
            ))}
          </div>
          <p className="muted small">
            Role boundaries still apply: production data tools are available
            only to PO; implementation writes are available only to Developer.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save agent
          </button>
        </div>
      </form>
    </Modal>
  );
}
function MetricModal({
  metric,
  connections,
  busy,
  onClose,
  onSave,
}: {
  metric: Partial<MetricMapping>;
  connections: ConnectionProfile[];
  busy: boolean;
  onClose: () => void;
  onSave: (value: unknown) => void;
}) {
  const [value, setValue] = useState({
    name: "",
    feature: "",
    connectionId: connections.find((c) => c.kind !== "ssh")?.id ?? "",
    query: "SELECT COUNT(*) AS total FROM ",
    expected: "",
    period: "Last 30 days",
    reviewed: false,
    ...metric,
  });
  const set = (key: string, val: unknown) => setValue({ ...value, [key]: val });
  return (
    <Modal title="Feature metric mapping" wide onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <Field label="Metric name">
              <input
                required
                value={value.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Feature or specification">
              <input
                required
                value={value.feature}
                onChange={(e) => set("feature", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Connection">
            <select
              required
              value={value.connectionId}
              onChange={(e) => set("connectionId", e.target.value)}
            >
              {connections
                .filter((c) => c.kind !== "ssh")
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label="Query"
            hint="SELECT for SQL databases. MongoDB accepts JSON with collection and pipeline."
          >
            <textarea
              required
              className="code-input"
              rows={6}
              value={value.query}
              onChange={(e) => set("query", e.target.value)}
            />
          </Field>
          <Field label="Expected behavior or baseline">
            <textarea
              rows={3}
              required
              value={value.expected}
              onChange={(e) => set("expected", e.target.value)}
            />
          </Field>
          <Field
            label="Observation period"
            hint="Describe the period actually selected by your query."
          >
            <input
              required
              value={value.period}
              onChange={(e) => set("period", e.target.value)}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.reviewed}
              onChange={(e) => set("reviewed", e.target.checked)}
            />{" "}
            I reviewed this feature mapping and query for recurring analysis.
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy || !value.connectionId}>
            Save mapping
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ScheduleModal({
  schedule,
  busy,
  onClose,
  onSave,
}: {
  schedule: Schedule;
  busy: boolean;
  onClose: () => void;
  onSave: (value: unknown) => void;
}) {
  const [enabled, setEnabled] = useState(schedule.enabled),
    [hours, setHours] = useState(schedule.intervalHours);
  return (
    <Modal title="Schedule PO analysis" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ enabled, intervalHours: hours });
        }}
      >
        <div className="modal-body">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Enable recurring PO analysis
          </label>
          <Field label="Run every (hours)">
            <input
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </Field>
          <p className="form-intro">
            Schedules run while Clinic’s local service is running. Missed runs
            are skipped. Review at least one feature metric before enabling.
          </p>
          {schedule.lastRunAt && (
            <p>Last run: {shortDate(schedule.lastRunAt)}</p>
          )}
          {!!schedule.skipped && (
            <p>{schedule.skipped} missed interval(s) skipped.</p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ConnectionExplorer({
  connection,
  prefix,
  act,
}: {
  connection: ConnectionProfile;
  prefix: string;
  act: Action;
}) {
  const [query, setQuery] = useState(
      connection.kind === "mongodb"
        ? '{"collection":"events","pipeline":[{"$count":"total"}]}'
        : connection.kind === "ssh"
          ? (connection.allowedPaths[0] ?? "")
          : "SELECT 1 AS connected",
    ),
    [result, setResult] = useState<unknown>(null);
  return (
    <>
      <p className="form-intro">
        {connection.kind === "ssh"
          ? "Read a permitted server file. Results are bounded and redacted."
          : "Inspect the schema or run a bounded read-only query. Successful queries create timestamped evidence."}
      </p>
      <Field label={connection.kind === "ssh" ? "Server file path" : "Query"}>
        <textarea
          className="code-input"
          rows={5}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>
      <div className="button-row">
        {connection.kind !== "ssh" && (
          <button
            className="secondary"
            onClick={() =>
              void act(async () =>
                setResult(
                  await api(`${prefix}/connections/${connection.id}/schema`),
                ),
              )
            }
          >
            Inspect schema
          </button>
        )}
        <button
          className="primary"
          onClick={() =>
            void act(async () =>
              setResult(
                await api(
                  `${prefix}/connections/${connection.id}/${connection.kind === "ssh" ? "read" : "query"}`,
                  connection.kind === "ssh" ? { path: query } : { query },
                ),
              ),
            )
          }
        >
          <Play size={14} />{" "}
          {connection.kind === "ssh" ? "Read file" : "Run query"}
        </button>
      </div>
      {result !== null && <JsonResult value={result} />}
    </>
  );
}
function RunInspector({
  detail,
  act,
  onCancel,
  onAnswer,
}: {
  detail: { run: Run; events: RunEvent[]; approvals: Approval[] };
  act: Action;
  onCancel: () => void;
  onAnswer: (approval: Approval, approved: boolean, answer?: string) => void;
}) {
  const { run, events, approvals } = detail;
  const [tab, setTab] = useState("activity"),
    [answer, setAnswer] = useState("");
  return (
    <>
      <div className="run-summary">
        <Badge value={run.status} />
        <span>{label(run.engine)} CLI</span>
        <span>{shortDate(run.startedAt)}</span>
        {run.specHash && (
          <span className="mono">spec {run.specHash.slice(0, 8)}</span>
        )}
        {run.codeRevision && (
          <span className="mono">code {run.codeRevision.slice(0, 8)}</span>
        )}
        {["running", "waiting", "queued"].includes(run.status) && (
          <button className="secondary small" onClick={onCancel}>
            <Square size={12} /> Stop run
          </button>
        )}
      </div>
      <div className="modal-body">
        {run.error && <div className="inline-error">{run.error}</div>}
        {approvals
          .filter((a) => a.status === "pending")
          .map((approval) => (
            <div className="approval-card" key={approval.id}>
              <h3>{approval.title}</h3>
              <JsonResult value={approval.details} />
              {approval.kind === "question" && (
                <Field label="Your answer">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </Field>
              )}
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => onAnswer(approval, false)}
                >
                  Decline
                </button>
                <button
                  className="primary"
                  onClick={() => onAnswer(approval, true, answer)}
                >
                  {approval.kind === "question" ? "Send answer" : "Approve"}
                </button>
              </div>
            </div>
          ))}
        <div className="tabs">
          <button
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
          <button
            className={tab === "output" ? "active" : ""}
            onClick={() => setTab("output")}
          >
            Output
          </button>
          {run.qa && (
            <button
              className={tab === "qa" ? "active" : ""}
              onClick={() => setTab("qa")}
            >
              QA report
            </button>
          )}
        </div>
        {tab === "activity" ? (
          <div className="event-list">
            {events
              .filter((e) => e.type !== "message")
              .map((event) => (
                <div className="event-row" key={event.id}>
                  <span className="event-dot" />
                  <span className="mono muted">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                  <div>
                    <strong>{label(event.type)}</strong>
                    <pre>
                      {JSON.stringify(event.data, null, 2).slice(0, 5000)}
                    </pre>
                  </div>
                </div>
              ))}
            {["running", "waiting"].includes(run.status) && (
              <div className="run-indicator">
                <Loader2 size={14} className="spin" />
                Following this run live…
              </div>
            )}
          </div>
        ) : tab === "output" ? (
          <pre className="source-view run-output">
            {run.output ??
              (events
                .filter((e) => e.type === "message")
                .map((e) => (e.data as { delta: string }).delta)
                .join("") ||
                "No output yet.")}
          </pre>
        ) : (
          run.qa && (
            <>
              <div className="qa-heading">
                <Badge value={run.qa.verdict} />
                <p>{run.qa.summary}</p>
              </div>
              {run.qa.checks.map((check, i) => (
                <details className="qa-check" key={i}>
                  <summary>
                    <Badge value={check.status} />
                    <strong>{check.name}</strong>
                  </summary>
                  <pre>{check.output}</pre>
                </details>
              ))}
              <h3>Acceptance scenarios</h3>
              {run.qa.criteria.map((criterion, i) => (
                <div className="criterion" key={i}>
                  <Badge value={criterion.status} />
                  <div>
                    <strong>{criterion.scenario}</strong>
                    <p>{criterion.evidence}</p>
                  </div>
                </div>
              ))}
            </>
          )
        )}
        {run.workspace && (
          <div className="workspace-path">
            <Folder size={14} />
            <code>{run.workspace}</code>
          </div>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
