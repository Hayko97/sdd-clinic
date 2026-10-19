import React, { useState } from "react";
import type { AgentDefinition, ConnectionProfile } from "../shared/types.js";
import { api } from "./api.js";
export function ConnectionSources({
  projectId,
  connections,
  agents,
  onEdit,
  onRefresh,
}: {
  projectId: string;
  connections: ConnectionProfile[];
  agents: AgentDefinition[];
  onEdit(connection: ConnectionProfile): void;
  onRefresh(): void;
}) {
  const [result, setResult] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const version = (c: ConnectionProfile) => `${c.id}:${c.updatedAt ?? ""}`;
  const act = async (connection: ConnectionProfile, remove = false) => {
    setBusy(connection.id);
    try {
      await api(
        `/projects/${projectId}/connections/${connection.id}${remove ? "" : "/test"}`,
        remove ? undefined : {},
        remove ? "DELETE" : "POST",
      );
      setResult((r) => ({
        ...r,
        [version(connection)]: remove ? "Removed" : "Connection test passed",
      }));
      onRefresh();
    } catch (e) {
      setResult((r) => ({ ...r, [version(connection)]: (e as Error).message }));
    } finally {
      setBusy(undefined);
    }
  };
  if (!connections.length) return null;
  return (
    <details className="chat-sources" open>
      <summary>Saved sources · {connections.length}</summary>
      {connections.map((c) => (
        <div className="chat-source" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            <small>
              {c.kind} ·{" "}
              {agents
                .filter((a) =>
                  c.agentIds ? c.agentIds.includes(a.id) : a.role === "po",
                )
                .map((a) => a.name)
                .join(", ")}{" "}
              ·{" "}
              {c.secretStorage === "encrypted"
                ? "Saved in encrypted vault"
                : c.secretStorage === "session"
                  ? "Session only — re-enter after restart"
                  : c.secretStorage === "keyring"
                    ? "Saved in credential store"
                    : "No password needed"}
            </small>
            <span role="status">
              {result[version(c)] ?? "Saved · not tested"}
            </span>
          </div>
          <div className="button-row">
            <button
              type="button"
              className="text-button"
              disabled={!!busy}
              onClick={() => void act(c)}
            >
              {busy === c.id ? "Working…" : "Test"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => onEdit(c)}
            >
              Update
            </button>
            <button
              type="button"
              className="text-button"
              disabled={!!busy}
              onClick={() => void act(c, true)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </details>
  );
}
