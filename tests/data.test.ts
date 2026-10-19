import { describe, it, expect, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import {
  ConnectionBroker,
  SecretVault,
  readonlySql,
  readonlyPipeline,
} from "../src/server/data.js";
import { Store } from "../src/server/store.js";
import { redact } from "../src/server/util.js";
import { tempDir } from "./helpers.js";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
describe("read-only evidence broker", () => {
  it.each([
    "DELETE FROM users",
    "SELECT 1; DELETE FROM users",
    "SELECT pg_sleep(20)",
    "SELECT load_extension('x')",
    "SELECT * FROM users INTO OUTFILE '/tmp/x'",
    "SELECT /* bypass */ 1",
    "SELECT * FROM users FOR UPDATE",
    "SELECT dblink_exec('x','DELETE')",
    "SELECT evil.date_trunc('day', timestamp) FROM events",
  ])("rejects unsafe query %s", (query) =>
    expect(() => readonlySql(query)).toThrow(),
  );
  it("permits bounded aggregate SELECT queries and quoted literal punctuation", () => {
    expect(
      readonlySql(
        "SELECT COUNT(*) AS count FROM events WHERE kind = 'semi;colon' GROUP BY status;",
      ),
    ).toContain("COUNT(*)");
  });
  it("rejects Mongo write stages and nested executable expressions", () => {
    expect(() =>
      readonlyPipeline('{"collection":"events","pipeline":[{"$out":"copy"}]}'),
    ).toThrow();
    expect(() =>
      readonlyPipeline(
        '{"collection":"events","pipeline":[{"$project":{"x":{"$function":{}}}}]}',
      ),
    ).toThrow();
    expect(
      readonlyPipeline(
        '{"collection":"events","pipeline":[{"$count":"total"}]}',
      ).collection,
    ).toBe("events");
  });
  it("queries a real SQLite database, bounds results, records evidence and isolates projects", async () => {
    const root = await tempDir();
    roots.push(root);
    const path = join(root, "sample.sqlite");
    const db = new DatabaseSync(path);
    db.exec("CREATE TABLE events(id INTEGER, password TEXT);");
    const insert = db.prepare("INSERT INTO events VALUES(?,?)");
    for (let i = 0; i < 1010; i++) insert.run(i, "secret-value");
    db.close();
    const store = new Store(":memory:"),
      broker = new ConnectionBroker(store, new SecretVault(false));
    const profile = await broker.save(
      "project-one",
      { name: "Sample", kind: "sqlite", path, readOnlyConfirmed: true },
      {},
    );
    const evidence = await broker.query(
      "project-one",
      profile.id,
      "SELECT * FROM events",
      "All observed events",
    );
    expect(evidence.rowCount).toBe(1000);
    expect(evidence.truncated).toBe(true);
    expect((evidence.result as any[])[0].password).toBe("[REDACTED]");
    expect(evidence.observedAt).toBeTruthy();
    await expect(
      broker.query("project-two", profile.id, "SELECT 1"),
    ).rejects.toThrow("not found");
    await expect(
      broker.query("project-one", profile.id, "DROP TABLE events"),
    ).rejects.toThrow("SELECT");
    const verify = new DatabaseSync(path, { readOnly: true });
    expect(
      (verify.prepare("SELECT COUNT(*) AS count FROM events").get() as any)
        .count,
    ).toBe(1010);
    verify.close();
    store.close();
  });
  it("keeps session secrets out of stored connection profiles", async () => {
    const store = new Store(":memory:"),
      broker = new ConnectionBroker(store, new SecretVault(false));
    const profile = await broker.save(
      "p",
      {
        name: "Private",
        kind: "postgres",
        username: "reader",
        readOnlyConfirmed: true,
      },
      { password: "very-private" },
    );
    expect(profile.secretStorage).toBe("session");
    expect(JSON.stringify(store.list("connection"))).not.toContain(
      "very-private",
    );
    expect(await broker.vault.get(profile.id, "session")).toEqual({
      password: "very-private",
    });
    await expect(
      new SecretVault(false).get(profile.id, "session"),
    ).rejects.toThrow("Re-enter");
    store.close();
  });
  it("redacts structured credentials, URLs and key material", () => {
    const redacted = JSON.stringify(
      redact({
        password: "p",
        nested: { api_key: "private" },
        line: "postgres://reader:private@host password=hello",
        quoted:
          '"password": "two word secret", API_TOKEN=\'another secret\' Authorization: Bearer private-value',
        key: "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
      }),
    );
    expect(redacted).not.toContain("private@");
    expect(redacted).not.toContain("hello");
    expect(redacted).not.toContain("secret");
    expect(redacted).toContain("[REDACTED]");
  });
});
