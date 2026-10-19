import { describe, it, expect, afterEach } from "vitest";
import { rm } from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { SecretVault } from "../src/server/data.js";
import type { Evidence, MetricMapping, Schedule } from "../src/shared/types.js";
import { tempDir } from "./helpers.js";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function setup() {
  const root = await tempDir();
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const clinic = await createApp({
    dataDir: root,
    discover: false,
    vault: new SecretVault(false),
  });
  cleanups.push(() => clinic.app.close());
  const session = await clinic.app.inject({
    method: "POST",
    url: "/api/session",
    payload: { token: clinic.bootstrapToken },
  });
  const cookie = session.cookies[0]!.value;
  const headers = { cookie: `clinic_session=${cookie}` };
  return { ...clinic, root, headers };
}
describe("local API and product analysis acceptance", () => {
  it("registers and sets up a project without a connected provider and lists its global inventory", async () => {
    const { app, root, headers } = await setup();
    const registration = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { path: root, engine: "codex", name: "Unconnected project" },
    });
    expect(registration.statusCode).toBe(200);
    const project = registration.json();
    let state = (await app.inject({ url: "/api/state", headers })).json();
    expect(state.projects[0].setupStatus).toBe("Setup needed");
    const prepared = (
      await app.inject({
        method: "POST",
        url: `/api/projects/${project.id}/setup`,
        headers,
        payload: {},
      })
    ).json();
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/projects/${project.id}/proposals/${prepared.proposal.id}/apply`,
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
    state = (await app.inject({ url: "/api/state", headers })).json();
    expect(state.projects[0]).toMatchObject({
      setupStatus: "Set up",
      specCount: 0,
      agentCount: 3,
      skillCount: 4,
    });
    await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { path: root, engine: "codex" },
    });
    expect(
      (await app.inject({ url: "/api/state", headers })).json().projects,
    ).toHaveLength(1);
  });

  it("requires a browser session and rejects foreign origins and hosts", async () => {
    const { app, headers } = await setup();
    expect((await app.inject("/api/state")).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/state", headers })).statusCode).toBe(
      200,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/projects",
          headers: { ...headers, origin: "https://evil.example" },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/api/state",
          headers: { ...headers, host: "127.0.0.1.evil.example" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("isolates evidence and requires real evidence before recording a finding", async () => {
    const { app, headers, store, runs } = await setup();
    store.put<Evidence>("evidence", {
      id: "e",
      projectId: "p",
      connectionId: "c",
      source: "SELECT COUNT(*)",
      observedAt: new Date().toISOString(),
      result: [{ count: 10 }],
      rowCount: 1,
      truncated: false,
    });
    expect(
      (await app.inject({ url: "/api/projects/other/evidence/e", headers }))
        .statusCode,
    ).toBe(404);
    const input = {
      title: "Investigate drop",
      kind: "bug",
      feature: "checkout",
      evidenceIds: ["e"],
      observed: "Ten outcomes",
      expected: "A documented baseline is needed.",
      uncertainty: "Insufficient baseline",
      action: "Investigate the period",
      priority: "medium",
      rationale: "May affect checkout",
      period: "Today",
      fingerprint: "checkout-drop",
      confirmed: false,
    };
    const a = runs.recordFinding("p", input),
      b = runs.recordFinding("p", input);
    expect(a.kind).toBe("investigation");
    expect(a.id).toBe(b.id);
    expect(store.list("finding", "p")).toHaveLength(1);
    expect(() => runs.recordFinding("other", input)).toThrow("not found");
  });
  it("skips missed schedule intervals at startup without starting analysis", async () => {
    const { store, runs } = await setup();
    const now = new Date("2026-10-17T10:00:00Z");
    store.put<Schedule>("schedule", {
      id: "p",
      projectId: "p",
      enabled: true,
      intervalHours: 2,
      nextRunAt: "2026-10-17T04:00:00Z",
    });
    await runs.scheduleTick(true, now);
    expect(store.require<Schedule>("schedule", "p").skipped).toBe(4);
    expect(store.list("run")).toHaveLength(0);
    expect(store.require<Schedule>("schedule", "p").nextRunAt).toBe(
      "2026-10-17T12:00:00.000Z",
    );
  });
  it("converts evidence-backed findings into a proposed OpenSpec change only once", async () => {
    const { root, projects, store, runs, specs } = await setup();
    const project = await projects.add(root, "codex");
    store.put<Evidence>("evidence", {
      id: "conversion-evidence",
      projectId: project.id,
      connectionId: "c",
      source: "SELECT COUNT(*) FROM events",
      observedAt: new Date().toISOString(),
      result: [{ count: 0 }],
      rowCount: 1,
      truncated: false,
    });
    const finding = runs.recordFinding(project.id, {
      title: "Instrument onboarding",
      kind: "instrumentation",
      feature: "onboarding",
      evidenceIds: ["conversion-evidence"],
      observed: "No recorded outcomes",
      expected: "Observe onboarding outcomes",
      uncertainty: "Absence of telemetry is not absence of use",
      action: "Add consent-aware outcome events",
      priority: "medium",
      rationale: "A baseline is needed",
      period: "Current schema",
      fingerprint: "onboarding-telemetry",
    });
    const change = await runs.convertFinding(project, finding.id);
    expect(
      (await specs.file(project, `openspec/changes/${change.name}/proposal.md`))
        .content,
    ).toContain("conversion-evidence");
    expect(specs.change(project, change.name).state).toBe("draft");
    await expect(runs.convertFinding(project, finding.id)).rejects.toThrow(
      "already",
    );
  });
});
