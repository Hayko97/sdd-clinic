import {
  connectionSchema,
  type ConnectionProfile,
  type ConnectionSecret,
} from "../shared/types.js";
import { AppError, assert } from "./util.js";

const guidance =
  "Paste one PostgreSQL, MySQL/MariaDB, MongoDB or SQLite URL, an ssh user@host command, or a block with type, host, user and password. No connection was saved.";
const aliases: Record<string, string> = {
  type: "kind",
  engine: "kind",
  driver: "kind",
  dbconnection: "kind",
  dbtype: "kind",
  dbhost: "host",
  pghost: "host",
  sshhost: "host",
  server: "host",
  dbport: "port",
  pgport: "port",
  sshport: "port",
  dbname: "database",
  dbdatabase: "database",
  pgdatabase: "database",
  user: "username",
  dbuser: "username",
  dbusername: "username",
  pguser: "username",
  sshuser: "username",
  pass: "password",
  pwd: "password",
  passwd: "password",
  dbpassword: "password",
  pgpassword: "password",
  sshpassword: "password",
  fingerprint: "hostKey",
  hostkey: "hostKey",
  allowedpaths: "allowedPaths",
  paths: "allowedPaths",
  privatekey: "privateKey",
  authsource: "authSource",
  tls: "tls",
  ssl: "tls",
  sshtunnel: "sshConnectionId",
  tunnel: "sshConnectionId",
};
export function parseConnectionInput(
  text: string,
  previous?: ConnectionProfile,
) {
  try {
    assert(text.length <= 64000, guidance);
    const values: Record<string, any> = {};
    const secret: ConnectionSecret = {};
    const key = text.match(
      /-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]+?-----END [\w ]*PRIVATE KEY-----/,
    );
    if (key) secret.privateKey = key[0];
    const content = text
      .replace(key?.[0] ?? /$^/, "")
      .replace(/^\/credentials\s*/i, "")
      .trim();
    if (content.startsWith("{")) {
      const input = JSON.parse(content);
      for (const [k, v] of Object.entries({
        ...input,
        ...input.profile,
        ...input.secret,
      })) {
        values[aliases[k.toLowerCase().replace(/[_ -]/g, "")] ?? k] = v;
      }
    } else {
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(
          /^\s*(?:export\s+|[-*]\s*)?([\w -]+)\s*[:=]\s*(.*?)\s*$/,
        );
        if (!m) continue;
        let value = m[2]!;
        if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
        const k = m[1]!.toLowerCase().replace(/[_ -]/g, "");
        values[aliases[k] ?? k] = value;
      }
    }
    const urls =
      content.match(
        /(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|sqlite|ssh):\/\/[^\s"'<>]+/gi,
      ) ?? [];
    assert(urls.length <= 1, guidance);
    if (urls[0]) {
      const url = new URL(urls[0]);
      values.kind = url.protocol.slice(0, -1);
      values.host = url.hostname.replace(/^\[|\]$/g, "");
      if (url.port) values.port = url.port;
      if (url.username) values.username = decodeURIComponent(url.username);
      if (url.password) secret.password = decodeURIComponent(url.password);
      if (url.pathname.length > 1)
        values[values.kind === "sqlite" ? "path" : "database"] =
          decodeURIComponent(
            url.pathname.slice(values.kind === "sqlite" ? 0 : 1),
          );
      if (url.searchParams.has("authSource"))
        values.authSource = url.searchParams.get("authSource");
      const tls =
        url.searchParams.get("tls") ??
        url.searchParams.get("ssl") ??
        url.searchParams.get("sslmode");
      if (tls) values.tls = !["false", "0", "disable"].includes(tls);
    } else {
      const ssh = content.match(
        /(?:^|\n)\s*ssh\s+(?:-p\s+(\d+)\s+)?([\w.-]+)@([\w.:-]+)(?:\s+-p\s+(\d+))?/,
      );
      if (ssh)
        Object.assign(values, {
          kind: "ssh",
          username: ssh[2],
          host: ssh[3],
          port: ssh[1] ?? ssh[4] ?? 22,
        });
    }
    for (const field of ["password", "privateKey", "passphrase"] as const)
      if (typeof values[field] === "string") secret[field] = values[field];
    assert(
      Object.values(secret).some(Boolean) ||
        [
          "kind",
          "host",
          "path",
          "username",
          "hostKey",
          "allowedPaths",
          "tls",
          "database",
        ].some((k) => values[k] !== undefined),
      guidance,
    );
    let kind = String(values.kind ?? previous?.kind ?? "").toLowerCase();
    if (kind === "postgresql" || kind === "pg") kind = "postgres";
    if (kind === "mariadb") kind = "mysql";
    if (kind === "mongodb+srv") {
      kind = "mongodb";
      values.srv = true;
    }
    const profile = connectionSchema.parse({
      ...previous,
      kind,
      name:
        values.name ??
        previous?.name ??
        `${kind} · ${values.host ?? values.path ?? "connection"}`,
      host: values.host ?? previous?.host,
      username: values.username ?? previous?.username,
      database: values.database ?? previous?.database,
      port: values.port !== undefined ? Number(values.port) : previous?.port,
      path: values.path ?? previous?.path,
      tls:
        values.tls !== undefined
          ? ![false, "false", "0", "disable"].includes(values.tls)
          : (previous?.tls ?? true),
      hostKey: values.hostKey ?? previous?.hostKey,
      allowedPaths: Array.isArray(values.allowedPaths)
        ? values.allowedPaths
        : typeof values.allowedPaths === "string"
          ? values.allowedPaths.split(/\s*,\s*/).filter(Boolean)
          : previous?.allowedPaths,
      sshConnectionId: values.sshConnectionId ?? previous?.sshConnectionId,
      authSource: values.authSource ?? previous?.authSource,
      srv: values.srv ?? previous?.srv,
      readOnlyConfirmed: true,
    });
    assert(
      kind === "sqlite"
        ? !!profile.path && profile.path.startsWith("/")
        : !!values.host || !!previous?.host,
      guidance,
    );
    assert(kind !== "ssh" || !!profile.username, guidance);
    // Do not let pasted secret values be echoed through ostensibly public fields.
    for (const value of Object.values(secret).filter(Boolean)) {
      for (const field of [
        profile.name,
        profile.host,
        profile.username,
        profile.database,
        profile.path,
        profile.hostKey,
        ...profile.allowedPaths,
      ])
        assert(
          !(value!.length >= 4 ? field.includes(value!) : field === value),
          guidance,
        );
    }
    return { profile, secret };
  } catch {
    throw new AppError(guidance);
  }
}
