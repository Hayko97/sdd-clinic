import { Worker } from "node:worker_threads";
import { createHash } from "node:crypto";
import { createConnection, createServer } from "node:net";
import { posix } from "node:path";
import { Client as SshClient, type SFTPWrapper } from "ssh2";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import {
  connectionSchema,
  type ConnectionProfile,
  type ConnectionSecret,
  type DataConnector,
  type Evidence,
  type ServerConnector,
} from "../shared/types.js";
import { Store } from "./store.js";
import { AppError, assert, id, now, redact } from "./util.js";

const ROW_LIMIT = 1000,
  TIMEOUT = 15000;
export { SecretVault } from "./vault.js";
import { SecretVault } from "./vault.js";

export function readonlySql(input: string) {
  assert(input.length <= 20000, "Query exceeds 20 KB.");
  const query = input.trim().replace(/;\s*$/, "");
  // Tokenize quoted values first. Comments, statements and arbitrary functions are
  // deliberately excluded: the query broker is for bounded analytics, not SQL shells.
  const tokens = query
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, "identifier")
    .replace(/`[^`]*`/g, "identifier");
  assert(/^SELECT\b/i.test(tokens), "Only SELECT queries are allowed.");
  assert(
    !/;|--|\/\*|\*\/|#|\$\$|\\/.test(tokens),
    "Comments and multiple statements are not allowed.",
  );
  assert(
    !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|COPY|CALL|EXEC|EXECUTE|GRANT|REVOKE|SET|INTO|OUTFILE|DUMPFILE|LOCK|FOR|LOAD|DO)\b/i.test(
      tokens,
    ),
    "This query contains an operation outside read-only analytics.",
  );
  const functions = new Set([
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "round",
    "abs",
    "coalesce",
    "nullif",
    "cast",
    "strftime",
    "date",
    "datetime",
    "julianday",
    "date_trunc",
    "extract",
    "lower",
    "upper",
    "length",
    "char_length",
    "substring",
    "concat",
    "trim",
    "floor",
    "ceil",
    "ceiling",
    "stddev",
    "stddev_pop",
    "stddev_samp",
    "variance",
    "year",
    "month",
    "day",
    "date_format",
    "ifnull",
    "if",
    "distinct",
    "in",
    "not",
    "exists",
    "select",
    "from",
    "as",
    "and",
    "or",
    "over",
    "filter",
  ]);
  for (const match of tokens.matchAll(/([a-z_][a-z_0-9]*)\s*\(/gi))
    assert(
      functions.has(match[1]!.toLowerCase()),
      `Function ${match[1]} is not allowed in analytics queries.`,
    );
  assert(
    !/\.\s*[a-z_][a-z_0-9]*\s*\(/i.test(tokens),
    "Schema-qualified functions are not allowed.",
  );
  return query;
}
export function readonlyPipeline(input: string) {
  const value = JSON.parse(input);
  assert(
    value &&
      typeof value.collection === "string" &&
      /^[\w.-]+$/.test(value.collection),
    "Mongo query requires a collection name.",
  );
  assert(
    Array.isArray(value.pipeline) && value.pipeline.length <= 20,
    "Mongo query requires a pipeline with at most 20 stages.",
  );
  const stages = new Set([
    "$match",
    "$group",
    "$project",
    "$sort",
    "$limit",
    "$skip",
    "$count",
    "$unwind",
    "$addFields",
    "$setWindowFields",
  ]);
  for (const stage of value.pipeline) {
    assert(
      stage && typeof stage === "object" && Object.keys(stage).length === 1,
      "Each pipeline stage must have one operator.",
    );
    assert(
      stages.has(Object.keys(stage)[0]!),
      "Only read-only aggregation stages are allowed.",
    );
  }
  assert(
    !/"\$(?:out|merge|where|function|accumulator|lookup|unionWith|documents)"/.test(
      JSON.stringify(value.pipeline),
    ),
    "This aggregation contains a forbidden operator.",
  );
  return value as { collection: string; pipeline: Record<string, unknown>[] };
}
function boundRows(rows: unknown[]) {
  const truncated = rows.length > ROW_LIMIT;
  const limited = rows.slice(0, ROW_LIMIT).map(redact);
  assert(
    JSON.stringify(limited).length <= 1_000_000,
    "Result exceeds 1 MB. Select fewer columns or aggregate the data.",
  );
  return { rows: limited, truncated };
}
async function sqliteQuery(path: string, query: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');let db;try{db=new DatabaseSync(workerData.path,{readOnly:true,allowExtension:false});db.exec('PRAGMA query_only=ON');const rows=db.prepare(workerData.query).all();parentPort.postMessage({rows});}catch(e){parentPort.postMessage({error:e.message});}finally{db?.close();}`,
      { eval: true, workerData: { path, query } },
    );
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new AppError("SQLite query timed out."));
    }, TIMEOUT);
    worker.once("message", (message) => {
      clearTimeout(timer);
      message.error
        ? reject(new AppError(message.error))
        : resolve(message.rows);
    });
    worker.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export class SshConnector implements ServerConnector {
  async connect(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
  ): Promise<SshClient> {
    assert(
      profile.hostKey.startsWith("SHA256:"),
      "Enter the verified SSH host fingerprint (SHA256:…).",
    );
    return new Promise((resolve, reject) => {
      const client = new SshClient();
      client.once("ready", () => resolve(client));
      client.once("error", (e) => {
        client.end();
        reject(e);
      });
      client.connect({
        host: profile.host,
        port: profile.port ?? 22,
        username: profile.username,
        password: secret.password,
        privateKey: secret.privateKey,
        passphrase: secret.passphrase,
        readyTimeout: TIMEOUT,
        hostVerifier: (key: Buffer) =>
          `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}` ===
          profile.hostKey,
      });
    });
  }
  async test(profile: ConnectionProfile, secret: ConnectionSecret) {
    const client = await this.connect(profile, secret);
    client.end();
    return { connected: true, mode: "SFTP and forwarding only" };
  }
  async read(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    path: string,
  ) {
    assert(
      profile.allowedPaths.length > 0,
      "Configure permitted server paths first.",
    );
    assert(
      posix.isAbsolute(path) && !path.includes("\0"),
      "Expected an absolute server path.",
    );
    const client = await this.connect(profile, secret);
    const timer = setTimeout(() => client.end(), TIMEOUT);
    try {
      const sftp = await new Promise<SFTPWrapper>((resolve, reject) =>
        client.sftp((err, s) => (err ? reject(err) : resolve(s))),
      );
      const canonical = (p: string) =>
        new Promise<string>((resolve, reject) =>
          sftp.realpath(p, (err, value) =>
            err ? reject(err) : resolve(value),
          ),
        );
      const target = await canonical(path);
      const roots = await Promise.all(profile.allowedPaths.map(canonical));
      assert(
        roots.some(
          (root) =>
            target === root || target.startsWith(root.replace(/\/$/, "") + "/"),
        ),
        "Requested path is outside the permitted server paths.",
      );
      const stats = await new Promise<{ size: number; isFile: () => boolean }>(
        (resolve, reject) =>
          sftp.stat(target, (err, value) =>
            err ? reject(err) : resolve(value),
          ),
      );
      assert(stats.isFile(), "Only regular server files can be read.");
      const start = /\.log(?:\.\d+)?$/.test(target)
        ? Math.max(0, stats.size - 65536)
        : 0;
      const text = await new Promise<string>((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        const stream = sftp.createReadStream(target, {
          start,
          end: start + 65535,
        });
        stream.on("data", (chunk: Buffer) => {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length > 65536)
            stream.destroy(new Error("Server read exceeded its limit."));
        });
        stream.on("end", () => resolve(buffer.toString("utf8")));
        stream.on("error", reject);
      });
      try {
        return JSON.stringify(redact(JSON.parse(text)), null, 2);
      } catch {
        return String(redact(text));
      }
    } finally {
      clearTimeout(timer);
      client.end();
    }
  }
  async tunnel(
    profile: ConnectionProfile,
    secret: ConnectionSecret,
    host: string,
    port: number,
  ) {
    const client = await this.connect(profile, secret);
    const sockets = new Set<import("node:net").Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      socket.on("error", () => socket.destroy());
      client.forwardOut("127.0.0.1", 0, host, port, (err, stream) => {
        if (err) {
          socket.destroy(err);
          return;
        }
        stream.on("error", () => socket.destroy());
        socket.pipe(stream).pipe(socket);
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    return {
      port: (server.address() as { port: number }).port,
      close: () => {
        for (const socket of sockets) socket.destroy();
        server.close();
        client.end();
      },
    };
  }
}

export class DatabaseConnector implements DataConnector {
  async test(profile: ConnectionProfile, secret: ConnectionSecret) {
    return profile.kind === "mongodb"
      ? this.inspect(profile, secret)
      : this.query(profile, secret, "SELECT 1 AS connected");
  }
  async inspect(profile: ConnectionProfile, secret: ConnectionSecret) {
    if (profile.kind === "sqlite")
      return this.query(
        profile,
        secret,
        "SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
    if (profile.kind === "postgres")
      return this.query(
        profile,
        secret,
        "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name, ordinal_position",
      );
    if (profile.kind === "mysql")
      return this.query(
        profile,
        secret,
        "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns ORDER BY table_schema, table_name, ordinal_position",
      );
    const client = this.mongo(profile, secret);
    try {
      await client.connect();
      const collections = await client
        .db(profile.database)
        .listCollections({}, { nameOnly: true })
        .toArray();
      return { collections: collections.map((c) => c.name).slice(0, 1000) };
    } finally {
      await client.close();
    }
  }
  private mongo(p: ConnectionProfile, s: ConnectionSecret) {
    return new MongoClient(
      p.srv
        ? `mongodb+srv://${p.host}`
        : `mongodb://${p.host.includes(":") ? `[${p.host}]` : p.host}:${p.port ?? 27017}`,
      {
        auth: p.username
          ? { username: p.username, password: s.password ?? "" }
          : undefined,
        authSource: p.authSource || p.database || "admin",
        tls: p.tls,
        servername:
          (p as ConnectionProfile & { tlsName?: string }).tlsName ?? p.host,
        serverSelectionTimeoutMS: TIMEOUT,
        connectTimeoutMS: TIMEOUT,
        socketTimeoutMS: TIMEOUT,
        maxPoolSize: 1,
        directConnection: !p.srv,
      },
    );
  }
  async query(p: ConnectionProfile, s: ConnectionSecret, input: string) {
    assert(
      p.readOnlyConfirmed,
      "Read-only analysis is not enabled for this connection.",
    );
    if (p.kind === "mongodb") {
      const query = readonlyPipeline(input);
      const client = this.mongo(p, s);
      try {
        await client.connect();
        return boundRows(
          await client
            .db(p.database)
            .collection(query.collection)
            .aggregate([...query.pipeline, { $limit: ROW_LIMIT + 1 }], {
              maxTimeMS: TIMEOUT,
              allowDiskUse: false,
            })
            .toArray(),
        );
      } finally {
        await client.close();
      }
    }
    const query = readonlySql(input),
      bounded = `SELECT * FROM (${query}) AS clinic_result LIMIT ${ROW_LIMIT + 1}`;
    if (p.kind === "sqlite") {
      assert(!!p.path, "Choose a SQLite file.");
      return boundRows(await sqliteQuery(p.path, bounded));
    }
    if (p.kind === "postgres") {
      const client = new PgClient({
        host: p.host,
        port: p.port ?? 5432,
        database: p.database,
        user: p.username,
        password: s.password,
        ssl: p.tls
          ? {
              rejectUnauthorized: true,
              servername: (p as any).tlsName ?? p.host,
            }
          : false,
        connectionTimeoutMillis: TIMEOUT,
        statement_timeout: TIMEOUT,
        query_timeout: TIMEOUT,
      });
      try {
        await client.connect();
        await client.query("BEGIN READ ONLY");
        const result = await client.query(bounded);
        return boundRows(result.rows);
      } finally {
        try {
          await client.query("ROLLBACK");
        } catch {}
        await client.end();
      }
    }
    assert(p.kind === "mysql", "Choose a database connection.");
    const tlsName = (p as ConnectionProfile & { tlsName?: string }).tlsName;
    const connection = await mysql.createConnection({
      host: tlsName ?? p.host,
      stream: tlsName
        ? () => createConnection({ host: p.host, port: p.port! })
        : undefined,
      port: p.port ?? 3306,
      database: p.database,
      user: p.username,
      password: s.password,
      ssl: p.tls ? { rejectUnauthorized: true } : undefined,
      connectTimeout: TIMEOUT,
      multipleStatements: false,
    });
    try {
      await connection.query("START TRANSACTION READ ONLY");
      const [rows] = await connection.query({ sql: bounded, timeout: TIMEOUT });
      return boundRows(rows as unknown[]);
    } finally {
      try {
        await connection.rollback();
      } catch {}
      await connection.end();
    }
  }
}

export class ConnectionBroker {
  readonly database = new DatabaseConnector();
  readonly server = new SshConnector();
  constructor(
    readonly store: Store,
    readonly vault: SecretVault,
  ) {}
  forAgent(projectId: string, agentId: string, role: string) {
    return this.store
      .list<ConnectionProfile>("connection", projectId)
      .filter((p) =>
        p.agentIds ? p.agentIds.includes(agentId) : role === "po",
      );
  }
  authorize(
    projectId: string,
    connectionId: string,
    agentId: string,
    role: string,
  ) {
    const profile = this.store.require<ConnectionProfile>(
      "connection",
      connectionId,
      projectId,
    );
    assert(
      profile.agentIds ? profile.agentIds.includes(agentId) : role === "po",
      "This connection is not assigned to this agent.",
      403,
    );
    return profile;
  }
  async save(
    projectId: string,
    input: unknown,
    secret: ConnectionSecret,
    existingId?: string,
  ) {
    const parsed = connectionSchema.parse(input);
    assert(
      !parsed.host.includes("://") && !parsed.host.includes("@"),
      "Enter a host name, not a credential-bearing URL.",
    );
    const connectionId = existingId ?? id();
    if (existingId)
      this.store.require<ConnectionProfile>(
        "connection",
        existingId,
        projectId,
      );
    if (parsed.sshConnectionId) {
      const ssh = this.store.require<ConnectionProfile>(
        "connection",
        parsed.sshConnectionId,
        projectId,
      );
      assert(ssh.kind === "ssh", "Tunnel profile must be an SSH connection.");
      assert(
        parsed.kind !== "sqlite" && parsed.kind !== "ssh",
        "SSH tunnels are for network databases.",
      );
    }
    const previous = existingId
      ? this.store.get<ConnectionProfile>("connection", existingId)
      : undefined;
    const secretStorage = Object.values(secret).some(Boolean)
      ? await this.vault.set(connectionId, secret)
      : (previous?.secretStorage ?? "none");
    return this.store.put<ConnectionProfile>("connection", {
      ...parsed,
      id: connectionId,
      projectId,
      secretStorage,
      updatedAt: now(),
    });
  }
  async withProfile<T>(
    projectId: string,
    connectionId: string,
    task: (profile: ConnectionProfile, secret: ConnectionSecret) => Promise<T>,
  ) {
    const profile = this.store.require<ConnectionProfile>(
      "connection",
      connectionId,
      projectId,
    );
    const secret = await this.vault.get(profile.id, profile.secretStorage);
    let tunnel: Awaited<ReturnType<SshConnector["tunnel"]>> | undefined;
    try {
      if (profile.sshConnectionId) {
        const ssh = this.store.require<ConnectionProfile>(
          "connection",
          profile.sshConnectionId,
          projectId,
        );
        tunnel = await this.server.tunnel(
          ssh,
          await this.vault.get(ssh.id, ssh.secretStorage),
          profile.host,
          profile.port ??
            ({ postgres: 5432, mysql: 3306, mongodb: 27017 } as any)[
              profile.kind
            ],
        );
        return await task(
          {
            ...profile,
            host: "127.0.0.1",
            port: tunnel.port,
            tlsName: profile.host,
          } as ConnectionProfile,
          secret,
        );
      }
      return await task(profile, secret);
    } finally {
      tunnel?.close();
    }
  }
  async test(projectId: string, connectionId: string) {
    return this.withProfile<unknown>(projectId, connectionId, (p, s) =>
      p.kind === "ssh" ? this.server.test(p, s) : this.database.test(p, s),
    );
  }
  async inspect(projectId: string, connectionId: string) {
    return this.withProfile(projectId, connectionId, (p, s) => {
      assert(p.kind !== "ssh", "Select a database to inspect its schema.");
      return this.database.inspect(p, s);
    });
  }
  async query(
    projectId: string,
    connectionId: string,
    query: string,
    period?: string,
  ) {
    const result = await this.withProfile(projectId, connectionId, (p, s) =>
      this.database.query(p, s, query),
    );
    return this.store.put<Evidence>("evidence", {
      id: id(),
      projectId,
      connectionId,
      source: query,
      observedAt: now(),
      result: result.rows,
      rowCount: result.rows.length,
      truncated: result.truncated,
      period,
    });
  }
  async read(projectId: string, connectionId: string, path: string) {
    const content = await this.withProfile(projectId, connectionId, (p, s) => {
      assert(p.kind === "ssh", "Select an SSH connection.");
      return this.server.read(p, s, path);
    });
    return this.store.put<Evidence>("evidence", {
      id: id(),
      projectId,
      connectionId,
      source: path,
      observedAt: now(),
      result: content,
      rowCount: 0,
      truncated: content.length >= 65536,
    });
  }
}
