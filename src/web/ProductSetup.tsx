import React, { useEffect, useState } from "react";
import type {
  SetupDraft,
  Proposal,
  Clarification,
  EngineConfig,
} from "../shared/types.js";
import { api } from "./api.js";
import { Modal } from "./Modal.js";

type Detail = SetupDraft & {
  proposal?: Proposal;
  clarification?: Clarification;
};
export function ProductSetup({
  engines,
  onApplied,
  onConnect,
}: {
  engines: EngineConfig[];
  onApplied: (id: string) => void;
  onConnect: () => void;
}) {
  const [drafts, setDrafts] = useState<SetupDraft[]>([]),
    [open, setOpen] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState(""),
    [destination, setDestination] = useState(""),
    [engine, setEngine] = useState<"codex" | "claude">("codex"),
    [prompt, setPrompt] = useState(""),
    [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const refresh = () => api<SetupDraft[]>("/setup-drafts").then(setDrafts);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!detail?.id || detail.status !== "running") return;
    const timer = setInterval(() => {
      void api<Detail>(`/setup-drafts/${detail.id}`)
        .then(setDetail)
        .catch((e) => setError(e.message));
    }, 1000);
    return () => clearInterval(timer);
  }, [detail?.id, detail?.status]);
  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load(id: string) {
    const d = await api<Detail>(`/setup-drafts/${id}`);
    setDetail(d);
    setPrompt(d.prompt);
    setAnswer("");
    setOpen(true);
  }
  async function save() {
    if (detail) {
      await api(`/setup-drafts/${detail.id}`, { prompt }, "PUT");
      return detail.id;
    }
    const d = await api<Detail>("/setup-drafts", {
      name,
      destination,
      engine,
      prompt,
    });
    setDetail(d);
    return d.id;
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    await act(async () => {
      const id = detail?.id ?? (await save());
      for (const file of selected) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error("Attachments must be at most 10 MiB.");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]!);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api(`/setup-drafts/${id}/attachments`, {
          name: file.name,
          base64,
        });
      }
      await load(id);
    });
  }
  const active = detail?.status === "running",
    review = detail?.status === "review",
    waiting = detail?.status === "needs-input";
  return (
    <section className="product-setup" aria-label="New project setup">
      <div className="button-row">
        <button
          className="primary"
          onClick={() => {
            setDetail(null);
            setPrompt("");
            setName("");
            setDestination("");
            setError("");
            setOpen(true);
          }}
        >
          New project from a brief
        </button>
        <span className="muted">
          A prompt, product documents, or UI/UX references → SDD specs
        </span>
      </div>
      {drafts
        .filter((d) => d.status !== "applied")
        .map((d) => (
          <button
            className="secondary setup-draft-link"
            key={d.id}
            onClick={() => void act(() => load(d.id))}
          >
            Resume setup: {d.name} · {d.status.replaceAll("-", " ")}
          </button>
        ))}
      {error && !open && <p role="alert">{error}</p>}
      {open && (
        <Modal
          title={detail ? `Set up ${detail.name}` : "New project from a brief"}
          wide
          onClose={() => setOpen(false)}
        >
          <div className="modal-body form-stack">
            <p>
              Describe your product or attach its documents and design
              references. Review the specs and agent instructions before saving
              them to the project.
            </p>
            {error && (
              <p role="alert" className="chat-error">
                {error}
              </p>
            )}
            {!detail && (
              <>
                <label>
                  Project name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Project destination
                  <input
                    placeholder="/projects/my-new-app"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </label>
                <p className="muted">
                  Choose an existing folder or a new folder inside a mounted
                  workspace. A new folder is created only when you Apply.
                </p>
                <label>
                  Setup engine
                  <select
                    value={engine}
                    onChange={(e) =>
                      setEngine(e.target.value as "codex" | "claude")
                    }
                  >
                    <option value="codex">Codex</option>
                    <option value="claude">Claude</option>
                  </select>
                </label>
              </>
            )}
            {detail && (
              <p className="muted">
                {detail.destination} · {detail.engine} ·{" "}
                {detail.status.replaceAll("-", " ")}
              </p>
            )}
            {!engines.find((e) => e.id === (detail?.engine ?? engine))
              ?.connected && (
              <div className="baseline-review-note">
                Connect the selected CLI to generate specifications. Your saved
                draft remains available.{" "}
                <button
                  onClick={() => {
                    setOpen(false);
                    onConnect();
                  }}
                >
                  Connect CLI
                </button>
              </div>
            )}
            <label>
              Product prompt
              <textarea
                rows={5}
                disabled={active || review || waiting}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Who is this for, what should it do, and what should it look like?"
              />
            </label>
            {!active && !review && !waiting && (
              <label>
                Attach product documents or UI/UX references
                <input
                  type="file"
                  multiple
                  accept=".md,.txt,.pdf,.docx,.png,.jpg,.jpeg"
                  disabled={
                    busy || (!detail && (!name.trim() || !destination.trim()))
                  }
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <p className="muted small">
              MD, TXT, PDF, DOCX, PNG or JPEG. Up to 20 files, 10 MiB each, 50
              MiB total. Scanned PDFs need text or image attachments. Originals
              are included in the reviewed project package.
            </p>
            {detail?.attachments.map((a) => (
              <article className="source-attachment" key={a.id}>
                <strong>{a.name}</strong>
                <span className="muted"> · {Math.ceil(a.bytes / 1024)} KB</span>
                {a.image && (
                  <img
                    alt={`Reference: ${a.name}`}
                    src={`/api/setup-drafts/${detail.id}/attachments/${a.id}`}
                  />
                )}
                <p role={a.error ? "alert" : undefined}>
                  {a.error ??
                    (a.image
                      ? "Ready for visual analysis"
                      : `${a.text.length} characters extracted${a.mime === "application/pdf" || a.name.endsWith(".docx") ? "; embedded images and layout are not analyzed—attach visual references separately." : ""}`)}
                </p>
                {!a.image && !a.error && (
                  <details>
                    <summary>Extracted text preview</summary>
                    <pre>
                      {a.text.slice(0, 4000)}
                      {a.text.length > 4000
                        ? "\n… preview only; the complete text will be analyzed."
                        : ""}
                    </pre>
                  </details>
                )}
                {!active && !review && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await api(
                          `/setup-drafts/${detail.id}/attachments/${a.id}`,
                          undefined,
                          "DELETE",
                        );
                        await load(detail.id);
                      })
                    }
                  >
                    Remove {a.name}
                  </button>
                )}
              </article>
            ))}
            {detail?.error && <p role="alert">{detail.error}</p>}
            {active && (
              <p role="status">
                Analyzing sources and preparing specifications… You can close
                this window and return to the saved draft.
              </p>
            )}
            {waiting && (
              <div className="setup-questions">
                <h3>Product questions</h3>
                {detail?.clarification?.questions.map((q, i) => (
                  <p key={i}>{q}</p>
                ))}
                <label>
                  Your answers
                  <textarea
                    rows={4}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </label>
              </div>
            )}
            {review && detail?.proposal && (
              <section aria-label="Review setup package">
                <h3>Review SDD package</h3>
                <p>
                  Intended behavior; application implementation and tests remain
                  unverified.
                </p>
                {detail.proposal.files.map((f) => (
                  <details key={f.path}>
                    <summary>
                      {f.path}
                      {f.encoding ? " · original attachment" : ""}
                    </summary>
                    {f.encoding ? (
                      <p>
                        Original attachment ·{" "}
                        {Math.floor((f.after.length * 3) / 4)} bytes. Preview
                        above.
                      </p>
                    ) : (
                      <pre>{f.diff}</pre>
                    )}
                  </details>
                ))}
              </section>
            )}
          </div>
          <div className="modal-footer button-row">
            {active ? (
              <button
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await api(`/setup-drafts/${detail!.id}/cancel`, {});
                    await load(detail!.id);
                  })
                }
              >
                Stop analysis
              </button>
            ) : review ? (
              <>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api(
                        `/setup-drafts/${detail!.id}`,
                        { prompt },
                        "PUT",
                      );
                      await load(detail!.id);
                    })
                  }
                >
                  Revise brief
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const d = await api<Detail>(
                        `/setup-drafts/${detail!.id}/apply`,
                        {},
                      );
                      setOpen(false);
                      onApplied(d.projectId);
                    })
                  }
                >
                  Apply SDD setup
                </button>
              </>
            ) : waiting ? (
              <button
                className="primary"
                disabled={busy || !answer.trim()}
                onClick={() =>
                  void act(async () => {
                    await api(`/setup-drafts/${detail!.id}/generate`, {
                      questionId: detail!.clarificationId,
                      answer,
                    });
                    await load(detail!.id);
                  })
                }
              >
                Send answers
              </button>
            ) : (
              <>
                <button
                  disabled={
                    busy || (!detail && (!name.trim() || !destination.trim()))
                  }
                  onClick={() => void act(async () => load(await save()))}
                >
                  Save draft
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    (!detail && (!name.trim() || !destination.trim())) ||
                    (!prompt.trim() && !detail?.attachments.length)
                  }
                  onClick={() =>
                    void act(async () => {
                      const id = await save();
                      await api(`/setup-drafts/${id}/generate`, {});
                      await load(id);
                    })
                  }
                >
                  Set up SDD
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
