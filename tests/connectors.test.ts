import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectionSchema,
  type ConnectionProfile,
} from "../src/shared/types.js";

const mocks = vi.hoisted(() => ({
  pg: { connect: vi.fn(), query: vi.fn(), end: vi.fn() },
  mysql: { query: vi.fn(), rollback: vi.fn(), end: vi.fn() },
  mongo: {
    connect: vi.fn(),
    close: vi.fn(),
    aggregate: vi.fn(),
    toArray: vi.fn(),
  },
  createMysql: vi.fn(),
}));
vi.mock("pg", () => ({
  Client: class {
    connect = mocks.pg.connect;
    query = mocks.pg.query;
    end = mocks.pg.end;
  },
}));
vi.mock("mysql2/promise", () => ({
  default: { createConnection: mocks.createMysql },
}));
vi.mock("mongodb", () => ({
  MongoClient: class {
    connect = mocks.mongo.connect;
    close = mocks.mongo.close;
    db() {
      return { collection: () => ({ aggregate: mocks.mongo.aggregate }) };
    }
  },
}));
import { DatabaseConnector } from "../src/server/data.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pg.query.mockResolvedValue({ rows: [{ count: 7 }] });
  mocks.mysql.query.mockResolvedValue([[{ count: 7 }]]);
  mocks.createMysql.mockResolvedValue(mocks.mysql);
  mocks.mongo.aggregate.mockReturnValue({ toArray: mocks.mongo.toArray });
  mocks.mongo.toArray.mockResolvedValue([{ count: 7 }]);
});
const profile = (
  kind: "postgres" | "mysql" | "mongodb",
): ConnectionProfile => ({
  ...connectionSchema.parse({ name: "Fixture", kind, readOnlyConfirmed: true }),
  id: "c",
  projectId: "p",
  secretStorage: "none",
});
describe("network database connector contracts", () => {
  it("uses a PostgreSQL read-only transaction and always rolls back and closes", async () => {
    const result = await new DatabaseConnector().query(
      profile("postgres"),
      {},
      "SELECT COUNT(*) FROM events",
    );
    expect(result.rows).toEqual([{ count: 7 }]);
    expect(mocks.pg.query).toHaveBeenNthCalledWith(1, "BEGIN READ ONLY");
    expect(mocks.pg.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("LIMIT 1001"),
    );
    expect(mocks.pg.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(mocks.pg.end).toHaveBeenCalledOnce();
  });
  it("uses a MySQL read-only transaction, query timeout, and cleanup after failure", async () => {
    mocks.mysql.query
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error("fixture database unavailable"));
    await expect(
      new DatabaseConnector().query(
        profile("mysql"),
        {},
        "SELECT COUNT(*) FROM events",
      ),
    ).rejects.toThrow("unavailable");
    expect(mocks.mysql.query).toHaveBeenNthCalledWith(
      1,
      "START TRANSACTION READ ONLY",
    );
    expect(mocks.mysql.query).toHaveBeenNthCalledWith(2, {
      sql: expect.stringContaining("LIMIT 1001"),
      timeout: 15000,
    });
    expect(mocks.mysql.rollback).toHaveBeenCalledOnce();
    expect(mocks.mysql.end).toHaveBeenCalledOnce();
  });
  it("limits Mongo results and execution time without disk writes", async () => {
    await new DatabaseConnector().query(
      profile("mongodb"),
      {},
      '{"collection":"events","pipeline":[{"$count":"total"}]}',
    );
    expect(mocks.mongo.aggregate).toHaveBeenCalledWith(
      [{ $count: "total" }, { $limit: 1001 }],
      { maxTimeMS: 15000, allowDiskUse: false },
    );
    expect(mocks.mongo.close).toHaveBeenCalledOnce();
  });
});
