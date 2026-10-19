import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { EventEmitter } from "node:events";
import type { ChangeRecord, Run, RunEvent } from "../shared/types.js";
import { now, AppError } from "./util.js";

export class Store {
  readonly db: DatabaseSync;
  readonly events = new EventEmitter();
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    const version = (
      this.db.prepare("PRAGMA user_version").get() as { user_version: number }
    ).user_version;
    if (version > 1) {
      this.db.close();
      throw new AppError(
        "This Clinic database was created by a newer version. Upgrade Clinic before opening it.",
      );
    }
    if (version < 1)
      this.db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT NOT NULL DEFAULT '', data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE INDEX IF NOT EXISTS records_project ON records(kind, project_id);
      CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_run ON events(run_id,id);
      PRAGMA user_version=1;
      COMMIT;`);
    this.events.setMaxListeners(200);
  }
  put<T extends { id: string; projectId?: string }>(
    kind: string,
    record: T,
  ): T {
    this.db
      .prepare(
        "INSERT INTO records(kind,id,project_id,data,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET project_id=excluded.project_id,data=excluded.data,updated_at=excluded.updated_at",
      )
      .run(
        kind,
        record.id,
        record.projectId ?? "",
        JSON.stringify(record),
        now(),
      );
    return record;
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  }
  require<T>(kind: string, id: string, projectId?: string): T {
    const record = this.get<T & { projectId?: string }>(kind, id);
    if (!record || (projectId !== undefined && record.projectId !== projectId))
      throw new AppError("Resource not found in this project.", 404);
    return record;
  }
  list<T>(kind: string, projectId?: string): T[] {
    const rows = (
      projectId === undefined
        ? this.db
            .prepare(
              "SELECT data FROM records WHERE kind=? ORDER BY updated_at DESC",
            )
            .all(kind)
        : this.db
            .prepare(
              "SELECT data FROM records WHERE kind=? AND project_id=? ORDER BY updated_at DESC",
            )
            .all(kind, projectId)
    ) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }
  delete(kind: string, id: string) {
    this.db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
  }
  append(runId: string, type: string, data: unknown) {
    const createdAt = now();
    const result = this.db
      .prepare(
        "INSERT INTO events(run_id,type,data,created_at) VALUES(?,?,?,?)",
      )
      .run(runId, type, JSON.stringify(data), createdAt);
    const event: RunEvent = {
      id: Number(result.lastInsertRowid),
      runId,
      type,
      data,
      createdAt,
    };
    this.events.emit(runId, event);
    return event;
  }
  replay(runId: string, after = 0): RunEvent[] {
    return (
      this.db
        .prepare(
          "SELECT id,run_id as runId,type,data,created_at as createdAt FROM events WHERE run_id=? AND id>? ORDER BY id LIMIT 10000",
        )
        .all(runId, after) as unknown as (Omit<RunEvent, "data"> & {
        data: string;
      })[]
    ).map((r) => ({ ...r, data: JSON.parse(r.data) }));
  }
  recover() {
    for (const run of this.list<Run>("run"))
      if (
        ["running", "waiting", "queued"].includes(run.status) &&
        !(
          run.clarificationId &&
          this.get<{ status: string }>("clarification", run.clarificationId)
            ?.status === "pending"
        )
      ) {
        this.put("run", {
          ...run,
          status: "interrupted",
          error:
            "The local service stopped. Partial work is preserved; resume explicitly.",
          endedAt: now(),
        });
        this.append(run.id, "interrupted", {
          message: "Service restarted; no actions were replayed.",
        });
      }
    for (const change of this.list<ChangeRecord>("change")) {
      if (["developing", "qa"].includes(change.state)) {
        this.put("change", {
          ...change,
          state: change.approvedHash ? "ready" : "draft",
          qaRunId: undefined,
          updatedAt: now(),
        });
      }
    }
    for (const approval of this.list<{ id: string; status: string }>(
      "approval",
    ))
      if (approval.status === "pending")
        this.put("approval", { ...approval, status: "denied" });
  }
  close() {
    this.db.close();
    this.events.removeAllListeners();
  }
}
