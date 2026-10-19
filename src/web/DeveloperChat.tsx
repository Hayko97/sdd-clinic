import React, { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { ArrowUp, ChevronDown, Loader2, Square, Terminal } from "lucide-react";
import type {
  AgentDefinition,
  Approval,
  DeveloperWorkflow,
  EngineConfig,
  Project,
  ProjectConfig,
  Proposal,
  Run,
  SpecFile,
} from "../shared/types.js";
import { api } from "./api.js";
import { useRun } from "./useRun.js";
import { ConnectionSources } from "./ConnectionSources.js";
import { containsConnectionDetails } from "../shared/connection-input.js";
import type { ConnectionProfile } from "../shared/types.js";
interface Props {
  data: {
    project: Project;
    config: ProjectConfig;
    agents: AgentDefinition[];
    workflows: DeveloperWorkflow[];
    proposals: Proposal[];
    runs: Run[];
    files: SpecFile[];
    connections: ConnectionProfile[];
  };
  engines: EngineConfig[];
  agentId: string;
  onAgent(id: string): void;
  composer: React.RefObject<HTMLTextAreaElement | null>;
  onConnections(): void;
  onRefresh(): void;
  onFile(file: SpecFile): void;
  onProposal(proposal: Proposal): void;
  onRun(run: Run): void;
  onSend(
    prompt: string,
    agentId: string,
    previousWorkflowId?: string,
  ): Promise<void>;
  onContinue(flow: DeveloperWorkflow, answer?: string): Promise<void>;
  onCancel(flow: DeveloperWorkflow): Promise<void>;
}
const stopped = new Set(["review", "failed", "interrupted", "canceled"]);
const stages: Record<string, string> = {
  analyzing: "Understanding your request",
  specifying: "Preparing the specification",
  continuing: "Validating reviewed specs",
  implementing: "Implementing and testing",
  qa: "Running independent QA",
  "awaiting-review": "Your specification is ready to review",
  "needs-input": "A little more context is needed",
  review: "Implementation and QA are ready for review",
  failed: "This attempt needs attention",
  interrupted: "Work was interrupted",
  canceled: "Work stopped",
};
export function DeveloperChat(props: Props) {
  const { data, agentId } = props;
  const draftKey = `clinic-draft:${data.project.id}:${agentId}`;
  const [draft, setDraft] = useState(() => {
    const saved = sessionStorage.getItem(draftKey) ?? "";
    if (containsConnectionDetails(saved)) {
      sessionStorage.removeItem(draftKey);
      return "";
    }
    return saved;
  });
  const [credentialMode, setCredentialMode] = useState(false);
  const [recipient, setRecipient] = useState(agentId);
  const [connectionId, setConnectionId] = useState<string>();
  const [receipt, setReceipt] = useState("");
  const sensitive = credentialMode || containsConnectionDetails(draft);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [help, setHelp] = useState(false),
    [historyIndex, setHistoryIndex] = useState(-1);
  const loadedKey = useRef(draftKey);
  const transcript = useRef<HTMLDivElement>(null),
    followBottom = useRef(true);
  const flows = data.workflows
    .filter((f) => f.agentId === agentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = flows.at(-1);
  const active = flows.findLast((f) => !stopped.has(f.stage));
  const running =
    active && !["awaiting-review", "needs-input"].includes(active.stage);
  const liveRun =
    active?.stage === "qa"
      ? data.runs.find((r) => r.kind === "qa" && r.change === active.change)
      : data.runs.find((r) => r.id === active?.runId);
  const detail = useRun(liveRun?.id ?? null, props.onRefresh);
  const agent = data.agents.find((a) => a.id === agentId);
  const engine =
    agent?.engine === "project"
      ? data.config.engine
      : (agent?.engine ?? data.config.engine);
  const connected = props.engines.some((e) => e.id === engine && e.connected);
  const commands = [
    { name: "/help", description: "Keyboard shortcuts" },
    { name: "/connect", description: "Connect your coding CLI" },
    { name: "/specs", description: "View project specifications" },
    { name: "/agents", description: "Configure this project’s agents" },
  ];
  const matches =
    draft.startsWith("/") && !draft.includes("\n")
      ? commands.filter((c) => c.name.startsWith(draft.trim()))
      : [];
  useEffect(() => {
    if (loadedKey.current !== draftKey) {
      loadedKey.current = draftKey;
      setDraft(sessionStorage.getItem(draftKey) ?? "");
      setCredentialMode(false);
      setConnectionId(undefined);
      setRecipient(agentId);
      setReceipt("");
      setHistoryIndex(-1);
      return;
    }
    if (sensitive) sessionStorage.removeItem(draftKey);
    else sessionStorage.setItem(draftKey, draft);
  }, [draftKey, draft, sensitive]);
  useEffect(() => {
    const area = props.composer.current;
    if (area) {
      area.style.height = "auto";
      area.style.height = `${Math.min(180, Math.max(60, area.scrollHeight))}px`;
    }
  }, [draft]);
  useEffect(() => {
    if (followBottom.current && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [data.workflows, detail?.events.length, help]);
  const act = async (task: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const executeCommand = (name: string) => {
    setDraft("");
    if (name === "/connect") props.onConnections();
    if (name === "/help") {
      setHelp((v) => !v);
      followBottom.current = true;
    }
    if (name === "/specs" || name === "/agents")
      document
        .getElementById(name === "/specs" ? "project-specs" : "project-agents")
        ?.scrollIntoView({ behavior: "smooth" });
  };
  const submit = () => {
    if (busy || !draft.trim()) return;
    if (sensitive) {
      void act(async () => {
        const saved = await api(
          `/projects/${data.project.id}/connection-prompt`,
          { prompt: draft, agentId: recipient || agentId, connectionId },
        );
        setDraft("");
        setCredentialMode(false);
        setConnectionId(undefined);
        setReceipt(saved.message);
        sessionStorage.removeItem(draftKey);
        props.onRefresh();
      });
      return;
    }
    const cmd = commands.find((c) => c.name === draft.trim());
    if (cmd) {
      executeCommand(cmd.name);
      return;
    }
    if (!connected) {
      props.onConnections();
      return;
    }
    if (active && active.stage !== "needs-input") return;
    void act(async () => {
      followBottom.current = true;
      if (active?.stage === "needs-input")
        await props.onContinue(active, draft);
      else await props.onSend(draft, agentId, latest?.id);
      setDraft("");
      setHistoryIndex(-1);
    });
  };
  const answerApproval = (approval: Approval, approved: boolean) =>
    void act(async () => {
      if (sensitive && approved)
        throw new Error(
          "Save these credentials as a connection, then answer without the credentials.",
        );
      await api(`/runs/${approval.runId}/approvals/${approval.id}`, {
        approved,
        answer: approval.kind === "question" ? draft : undefined,
      });
      if (approval.kind === "question") setDraft("");
      props.onRefresh();
    });
  const streamed =
    detail?.events
      .filter((e) => e.type === "message")
      .map((e) => (e.data as { delta?: string }).delta ?? "")
      .join("") ?? "";
  const tools =
    detail?.events.filter(
      (e) => e.type === "tool" || e.type === "check" || e.type === "skill",
    ) ?? [];
  return (
    <section className="developer-chat" aria-label="Developer chat">
      <header className="chat-topline">
        <span className="chat-mark">✳</span>
        <div>
          <strong>Developer</strong>
          <span>
            {data.project.name} <span aria-hidden="true">/</span>{" "}
            {agent?.model || "Default model"}
          </span>
        </div>
        <button
          className={`chat-connection ${connected ? "ready" : ""}`}
          onClick={props.onConnections}
        >
          <span /> {engine} · {connected ? "connected" : "sign in"}
        </button>
      </header>
      <div
        className="chat-transcript"
        role="log"
        aria-label="Developer conversation"
        ref={transcript}
        onScroll={() => {
          const el = transcript.current!;
          followBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {!flows.length && (
          <div className="chat-welcome">
            <span className="welcome-mark">✳</span>
            <h2>What would you like to build?</h2>
            <p>
              Describe a feature or a fix. Your Developer reviews the specs,
              <br /> proposes changes, then implements and tests.
            </p>
            <div className="chat-suggestions">
              {["Fix a bug", "Build a feature", "Refine a specification"].map(
                (text) => (
                  <button
                    key={text}
                    onClick={() => {
                      setDraft(`${text}: `);
                      props.composer.current?.focus();
                    }}
                  >
                    {text}
                  </button>
                ),
              )}
            </div>
            <small>analyse request → specs → review → implement → QA</small>
          </div>
        )}
        {flows.map((flow) => {
          const run = data.runs.find((r) => r.id === flow.runId);
          const proposal = data.proposals.find((p) => p.id === flow.proposalId);
          const file = data.files.find(
            (f) => f.change === flow.change && f.path.endsWith("proposal.md"),
          );
          return (
            <article className="chat-turn workflow-card" key={flow.id}>
              <div className="chat-user">
                <span aria-hidden="true">❯</span>
                <div>
                  <span className="message-author">You</span>
                  <p>{flow.prompt}</p>
                </div>
              </div>
              <div className="chat-assistant">
                <span className="assistant-mark" aria-hidden="true">
                  ✳
                </span>
                <div className="assistant-body">
                  <div className="assistant-heading">
                    <strong>Developer</strong>
                    <span className="stage-label">
                      {flow.stage.replaceAll("-", " ")}
                    </span>
                  </div>
                  <p className="chat-stage">
                    {flow === active && running && (
                      <Loader2 size={14} className="spin" />
                    )}
                    {stages[flow.stage]}
                  </p>
                  {flow.summary && (
                    <div className="chat-markdown">
                      <Markdown>{flow.summary}</Markdown>
                    </div>
                  )}
                  {!!flow.clarifications?.length && (
                    <details className="clarification-history">
                      <summary>
                        Product decisions ({flow.clarifications.length})
                      </summary>
                      {flow.clarifications.map((q) => (
                        <div key={q.id}>
                          <strong>
                            {q.stage} · {q.status}
                          </strong>
                          <p>{q.questions.join("\n")}</p>
                          {q.answer && <p>Answer: {q.answer}</p>}
                        </div>
                      ))}
                    </details>
                  )}
                  {flow.error && (
                    <p role="alert" className="chat-error">
                      {flow.error}
                    </p>
                  )}
                  {run && run.kind !== "planning" && run.output && (
                    <div className="chat-markdown">
                      <Markdown>{run.output}</Markdown>
                    </div>
                  )}
                  {flow === active &&
                    liveRun?.kind === "developer" &&
                    !run?.output &&
                    streamed && (
                      <div className="chat-markdown streaming">
                        <Markdown>{streamed}</Markdown>
                      </div>
                    )}
                  {flow.change && (
                    <div className="chat-context">Change · {flow.change}</div>
                  )}
                  {flow === active && tools.length > 0 && (
                    <details className="chat-activity">
                      <summary>
                        <Terminal size={13} /> Activity · {tools.length} events
                      </summary>
                      {tools.slice(-30).map((event) => (
                        <div key={event.id}>
                          {event.type} ·{" "}
                          {String(
                            (event.data as any)?.name ??
                              (event.data as any)?.command ??
                              (event.data as any)?.type ??
                              "Project operation",
                          ).slice(0, 500)}
                        </div>
                      ))}
                    </details>
                  )}
                  {flow === active &&
                    detail?.approvals
                      .filter((a) => a.status === "pending")
                      .map((approval) => (
                        <div className="chat-approval" key={approval.id}>
                          <strong>{approval.title}</strong>
                          <pre>{JSON.stringify(approval.details, null, 2)}</pre>
                          {approval.kind === "question" && (
                            <p>
                              Write your answer in the composer, then send it
                              here.
                            </p>
                          )}
                          <button
                            className="primary small"
                            disabled={
                              busy ||
                              (approval.kind === "question" && !draft.trim())
                            }
                            onClick={() => answerApproval(approval, true)}
                          >
                            {approval.kind === "question"
                              ? "Send answer"
                              : "Approve action"}
                          </button>
                          <button
                            className="secondary small"
                            disabled={busy}
                            onClick={() => answerApproval(approval, false)}
                          >
                            Decline
                          </button>
                        </div>
                      ))}
                  <div className="chat-turn-actions">
                    {proposal && (
                      <button
                        className="secondary small"
                        onClick={() => props.onProposal(proposal)}
                      >
                        Review spec diff
                      </button>
                    )}
                    {file && (
                      <button
                        className="text-button"
                        onClick={() => props.onFile(file)}
                      >
                        Open change
                      </button>
                    )}
                    {flow.stage === "awaiting-review" && (
                      <button
                        className="primary small"
                        disabled={busy}
                        onClick={() => void act(() => props.onContinue(flow))}
                      >
                        Approve specs & implement
                      </button>
                    )}
                    {["failed", "interrupted"].includes(flow.stage) && (
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() => void act(() => props.onContinue(flow))}
                      >
                        Retry workflow
                      </button>
                    )}
                    {run && (
                      <button
                        className="text-button"
                        onClick={() => props.onRun(run)}
                      >
                        View evidence
                      </button>
                    )}
                    {!stopped.has(flow.stage) && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void act(() => props.onCancel(flow))}
                      >
                        Cancel workflow
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {help && (
          <div className="chat-help">
            <strong>Keyboard shortcuts</strong>
            <p>
              Enter sends · Shift+Enter adds a line · Up recalls a prompt from
              an empty composer · Escape stops active work.
            </p>
            <p>/connect · /specs · /agents · /help</p>
          </div>
        )}
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {receipt && (
          <p className="composer-notice" role="status">
            {receipt}
          </p>
        )}
        {sensitive && (
          <div className="credential-mode">
            <strong>
              {connectionId
                ? "Update saved connection"
                : "Save connection for an agent"}
            </strong>
            <p>
              Paste a database URL, SSH command or credential block. Credentials
              stay out of chat history.
            </p>
            <label>
              Agent{" "}
              <select
                aria-label="Connection agent"
                value={recipient || agentId}
                onChange={(e) => setRecipient(e.target.value)}
              >
                {data.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraft("");
                setCredentialMode(false);
                setConnectionId(undefined);
              }}
            >
              Discard credentials
            </button>
            <details>
              <summary>Accepted formats</summary>
              <pre>
                {
                  'postgresql://reader:password@host:5432/database\n\ntype: mysql\nhost: localhost\nuser: reader\npassword: "your password"\n\nssh reader@host -p 22\npassword: "your password"\nfingerprint: SHA256:verified-host-fingerprint\npaths: /var/log/my-app'
                }
              </pre>
              <p>
                Also accepts MongoDB and absolute SQLite file URLs. SSH reads
                need a verified fingerprint and permitted paths. Agent tools use
                read-only access.
              </p>
            </details>
          </div>
        )}
        {error && (
          <p role="alert" className="chat-error">
            {error}
          </p>
        )}
        {active?.stage === "awaiting-review" && (
          <p className="composer-notice">
            Review the specification above, then approve or cancel before
            sending another request.
          </p>
        )}
        {active?.stage === "needs-input" && (
          <p className="composer-notice">
            Reply below to clarify your request.
          </p>
        )}
        <div className="chat-input-line">
          <span className="prompt-caret" aria-hidden="true">
            ❯
          </span>
          <label className="sr-only" htmlFor="developer-prompt">
            Prompt for Developer
          </label>
          <textarea
            id="developer-prompt"
            ref={props.composer}
            value={draft}
            onChange={(e) => {
              if (containsConnectionDetails(e.target.value))
                setCredentialMode(true);
              setDraft(e.target.value);
              setHistoryIndex(-1);
            }}
            placeholder={
              active?.stage === "needs-input"
                ? "Your answer…"
                : "Ask Developer to build, fix, or explain…"
            }
            rows={2}
            autoComplete="off"
            spellCheck={!sensitive}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape" && running) {
                e.preventDefault();
                void act(() => props.onCancel(active));
              }
              if (
                !sensitive &&
                e.key === "ArrowUp" &&
                (!draft || historyIndex >= 0) &&
                flows.length
              ) {
                e.preventDefault();
                const index = Math.min(historyIndex + 1, flows.length - 1);
                setHistoryIndex(index);
                setDraft(flows[flows.length - 1 - index]!.prompt);
              }
              if (e.key === "ArrowDown" && historyIndex >= 0) {
                e.preventDefault();
                const index = historyIndex - 1;
                setHistoryIndex(index);
                setDraft(
                  index < 0 ? "" : flows[flows.length - 1 - index]!.prompt,
                );
              }
            }}
          />
        </div>
        {!!matches.length && (
          <div className="slash-menu" aria-label="Chat shortcuts">
            {matches.map((command) => (
              <button
                type="button"
                key={command.name}
                onClick={() => executeCommand(command.name)}
              >
                <code>{command.name}</code>
                <span>{command.description}</span>
              </button>
            ))}
          </div>
        )}
        <div className="chat-composer-footer">
          <label className="chat-agent-picker">
            <select
              aria-label="Developer agent"
              value={agentId}
              onChange={(e) => props.onAgent(e.target.value)}
            >
              {data.agents
                .filter((a) => a.role === "developer")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
            <ChevronDown size={12} />
          </label>
          <span className="chat-key-hint">
            ↵ send · ⇧↵ newline · / shortcuts
          </span>
          {!sensitive && (
            <button
              type="button"
              className="text-button credentials-toggle"
              onClick={() => {
                setCredentialMode(true);
                setRecipient(agentId);
                props.composer.current?.focus();
              }}
            >
              Paste credentials
            </button>
          )}
          {sensitive ? (
            <button
              className="chat-save"
              disabled={busy || !draft.trim() || !recipient}
            >
              Save connection
            </button>
          ) : running ? (
            <button
              type="button"
              className="chat-send stop"
              aria-label="Stop Developer"
              disabled={busy}
              onClick={() => void act(() => props.onCancel(active))}
            >
              <Square size={15} /> Stop
            </button>
          ) : (
            <button
              className="chat-send"
              aria-label={
                !connected
                  ? `Connect ${engine}`
                  : active?.stage === "needs-input"
                    ? "Send answer"
                    : "Run Developer"
              }
              disabled={
                busy ||
                !draft.trim() ||
                !agentId ||
                active?.stage === "awaiting-review"
              }
            >
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <ArrowUp size={17} />
              )}
            </button>
          )}
        </div>
      </form>
      <ConnectionSources
        projectId={data.project.id}
        connections={data.connections}
        agents={data.agents}
        onRefresh={props.onRefresh}
        onEdit={(c) => {
          setConnectionId(c.id);
          setCredentialMode(true);
          setRecipient(c.agentIds?.[0] ?? agentId);
          setDraft("");
          setReceipt("");
          props.composer.current?.focus();
        }}
      />
    </section>
  );
}
