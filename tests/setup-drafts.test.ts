import { qualityFixture } from "./setup-quality-fixture.js";
import { afterEach, expect, it } from "vitest";
import { join } from "node:path";
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  access,
  symlink,
} from "node:fs/promises";
import { createApp } from "../src/server/app.js";
import { SetupDrafts } from "../src/server/setup-drafts.js";
import { SecretVault } from "../src/server/vault.js";
import { adapters } from "../src/server/engines.js";
import type {
  EngineAdapter,
  EngineRequest,
  EngineKind,
  Proposal,
} from "../src/shared/types.js";
import { tempDir, waitRun } from "./helpers.js";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const f of cleanup.splice(0).reverse()) await f();
});
export const productSpec =
  "# Catalog Specification\n\n## Purpose\nHelp visitors discover products that are available to order.\n\n## Requirements\n\n### Requirement: Browse catalog\nThe system SHALL show available products.\n\n#### Scenario: Available products\n- **WHEN** a visitor opens the catalog\n- **THEN** available products are shown.\n";
async function fixture(engine: EngineKind = "codex") {
  const root = await tempDir();
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const calls: EngineRequest[] = [];
  let questions = false,
    invalid = false,
    missing = false,
    hang = false;
  let transform: ((result: any) => any) | undefined;
  const provider: EngineAdapter = {
    probe: adapters.codex.probe,
    async run(_p, r) {
      calls.push(r);
      if (r.prompt.includes("CLINIC_SETUP_QUALITY"))
        return {
          sessionId: "quality-fixture",
          text: JSON.stringify(qualityFixture(r.prompt)),
        };
      if (hang)
        await new Promise((_, reject) =>
          r.signal.addEventListener(
            "abort",
            () => reject(new Error("interrupted")),
            { once: true },
          ),
        );
      let result: unknown;
      if (r.prompt.includes("CLINIC_PRODUCT_SOURCES")) {
        const chunks = JSON.parse(r.prompt.split("SOURCES\n").at(-1)!);
        result = {
          reviewed: missing ? [] : chunks.map((c: any) => c.id),
          findings:
            "Catalog products and green UI. Sources: " +
            chunks.map((c: any) => c.path).join(","),
        };
      } else if (r.prompt.includes("CLINIC_PRODUCT_IMAGE"))
        return {
          sessionId: "image",
          text: "Use a green primary action; image interpretation needs owner review.",
        };
      else {
        const sourceIds = JSON.parse(
          r.prompt.split("Allowed source IDs: ")[1]!.split("\n")[0]!,
        );
        result = questions
          ? {
              summary: "Choose scope",
              questions: ["Should guests browse without signing in?"],
              files: [],
            }
          : {
              summary: "Catalog baseline",
              questions: [],
              files: [
                {
                  path: "openspec/specs/catalog/spec.md",
                  content: invalid ? "broken" : productSpec,
                  sourceIds: [sourceIds[0]],
                },
                ...["mission", "tech-stack", "roadmap", "ui-ux"].map(
                  (name) => ({
                    path: `openspec/project/${name}.md`,
                    content: `# ${name}\nCatalog product guidance; technology remains undecided.`,
                    sourceIds: [],
                  }),
                ),
              ],
            };
      }
      return {
        sessionId: "product-fixture",
        text: JSON.stringify(
          transform && r.prompt.includes("CLINIC_PRODUCT_SYNTHESIZE")
            ? transform(result)
            : result,
        ),
      };
    },
  };
  const c = await createApp({
    dataDir: join(root, "state"),
    discover: false,
    vault: new SecretVault(false),
    providers: { codex: provider, claude: provider },
  });
  cleanup.push(() => c.app.close());
  c.store.put("engine", { id: engine, path: "fixture", connected: true });
  const drafts = new SetupDrafts(c.runs);
  const d = await drafts.create({
    name: "New shop",
    destination: join(root, "new-shop"),
    engine,
    prompt: "Build a catalog with accessible green UI.",
  });
  return {
    ...c,
    root,
    drafts,
    d,
    calls,
    setTransform: (value: (result: any) => any) => (transform = value),
    setQuestions: (v: boolean) => (questions = v),
    setInvalid: (v: boolean) => (invalid = v),
    setMissing: (v: boolean) => (missing = v),
    setHang: (v: boolean) => (hang = v),
  };
}
for (const engine of ["codex", "claude"] as const)
  it(`creates a reviewed ${engine} product package and preserves original attachments without initial destination writes`, async () => {
    const c = await fixture(engine);
    const text = Buffer.from(
      "Product requirements: list available products.\n" +
        "details\n".repeat(5000),
    );
    await c.drafts.upload(c.d.id, "brief.md", text.toString("base64"));
    const d = await c.drafts.generate(c.d.id);
    expect((await waitRun(c.store, d.runId!)).status).toBe("completed");
    const ready = c.drafts.get(d.id);
    expect(ready.status).toBe("review");
    await expect(access(ready.destination)).rejects.toThrow();
    expect(
      c.calls
        .filter((r) => r.prompt.includes("CLINIC_PRODUCT_SOURCES"))
        .map((r) => r.prompt)
        .join(""),
    ).toContain("details");
    expect(
      c.calls.every((r) => r.mode === "read-only" && !r.tools?.length),
    ).toBe(true);
    const p = c.store.require<Proposal>("proposal", ready.proposalId!);
    expect(p.files.some((f) => f.encoding === "base64")).toBe(true);
    await expect(
      c.specs.apply(c.projects.get(d.projectId), p.id),
    ).rejects.toThrow("setup draft");
    await c.drafts.apply(d.id);
    const project = c.projects.get(d.projectId);
    expect(project.path).toBe(ready.destination);
    expect(project.setupDraft).toBe(false);
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md",
      ".cursor/rules/sdd-clinic.mdc",
      "openspec/specs/catalog/spec.md",
      "openspec/specs/catalog/validation.md",
      "CHANGELOG.md",
      "openspec/project/ui-ux.md",
    ])
      expect(await readFile(join(project.path, path), "utf8")).toBeTruthy();
    const a = ready.attachments[0]!;
    expect(
      await readFile(
        join(project.path, `openspec/project/sources/${a.id}-${a.name}`),
      ),
    ).toEqual(text);
    await expect(access(join(project.path, ".git"))).rejects.toThrow();
  });
it("retains durable setup questions, rejects stale answers, resumes after restart, and invalidates reviewed drafts on edits", async () => {
  const c = await fixture();
  c.setQuestions(true);
  const run = await c.drafts.generate(c.d.id);
  await waitRun(c.store, run.runId!);
  const waiting = c.drafts.get(c.d.id);
  expect(waiting.status).toBe("needs-input");
  c.store.recover();
  const restored = new SetupDrafts(c.runs);
  expect(restored.get(waiting.id).clarificationId).toBe(
    waiting.clarificationId,
  );
  await expect(
    restored.generate(waiting.id, { questionId: "old", answer: "Yes" }),
  ).rejects.toThrow("current questions");
  c.setQuestions(false);
  const resumed = await restored.generate(waiting.id, {
    questionId: waiting.clarificationId!,
    answer: "Guests can browse.",
  });
  await waitRun(c.store, resumed.runId!);
  expect(c.calls.at(-1)!.prompt).toContain("Guests can browse");
  const ready = restored.get(waiting.id);
  expect(ready.status).toBe("review");
  restored.update(ready.id, "Change the product brief");
  expect(c.store.require<Proposal>("proposal", ready.proposalId!).status).toBe(
    "rejected",
  );
  await expect(restored.apply(ready.id)).rejects.toThrow("review");
});
it("preserves drafts offline and rejects omitted chunks, malformed specs and unexpected destinations", async () => {
  const c = await fixture();
  c.store.put("engine", { id: "codex", path: "fixture", connected: false });
  await expect(c.drafts.generate(c.d.id)).rejects.toThrow("Connect");
  expect(c.drafts.get(c.d.id).prompt).toBeTruthy();
  c.store.put("engine", { id: "codex", path: "fixture", connected: true });
  c.setMissing(true);
  let d = await c.drafts.generate(c.d.id);
  expect((await waitRun(c.store, d.runId!)).error).toContain("omitted");
  c.setMissing(false);
  c.setInvalid(true);
  d = await c.drafts.generate(d.id);
  expect((await waitRun(c.store, d.runId!)).error).toContain("validation");
  c.setInvalid(false);
  d = await c.drafts.generate(d.id);
  await waitRun(c.store, d.runId!);
  await mkdir(d.destination);
  await writeFile(join(d.destination, "owner.txt"), "keep");
  await expect(c.drafts.apply(d.id)).rejects.toThrow();
  expect(await readFile(join(d.destination, "owner.txt"), "utf8")).toBe("keep");
  d = await c.drafts.generate(d.id);
  await waitRun(c.store, d.runId!);
  await c.drafts.apply(d.id);
  expect(await readFile(join(d.destination, "owner.txt"), "utf8")).toBe("keep");
});
it("handles image and text-only attachment input and exposes unsupported or unreadable uploads", async () => {
  const c = await fixture();
  c.drafts.update(c.d.id, "");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6n8AAAAASUVORK5CYII=",
    "base64",
  );
  await c.drafts.upload(c.d.id, "layout.png", png.toString("base64"));
  await c.drafts.upload(
    c.d.id,
    "reference.jpg",
    (await readFile("tests/fixtures/product-sources/reference.jpg")).toString(
      "base64",
    ),
  );
  await c.drafts.upload(
    c.d.id,
    "notes.txt",
    Buffer.from("Catalog UX").toString("base64"),
  );
  let d = await c.drafts.generate(c.d.id);
  await waitRun(c.store, d.runId!);
  expect(c.calls.some((r) => r.images?.[0]?.mime === "image/png")).toBe(true);
  expect(c.calls.some((r) => r.images?.[0]?.mime === "image/jpeg")).toBe(true);
  await expect(
    c.drafts.upload(
      d.id,
      "large.txt",
      Buffer.alloc(10 * 1024 * 1024 + 1, 65).toString("base64"),
    ),
  ).rejects.toThrow("10 MiB");
  await expect(c.drafts.upload(d.id, "run.exe", "YQ==")).rejects.toThrow(
    "Supported",
  );
  d = await c.drafts.upload(
    d.id,
    "bad.pdf",
    Buffer.from("not a PDF").toString("base64"),
  );
  expect(d.attachments.at(-1)?.error).toBeTruthy();
  await expect(c.drafts.generate(d.id)).rejects.toThrow("unreadable");
  await c.drafts.remove(d.id, d.attachments.at(-1)!.id);
  expect(c.drafts.get(d.id).attachments).toHaveLength(3);
});
it("cancels analysis without touching destination and rejects concurrent runs and symlinks", async () => {
  const c = await fixture();
  c.setHang(true);
  const d = await c.drafts.generate(c.d.id);
  await expect(c.drafts.generate(d.id)).rejects.toThrow("stop");
  await new Promise((r) => setTimeout(r, 50));
  await c.drafts.cancel(d.id);
  expect((await waitRun(c.store, d.runId!)).status).toBe("interrupted");
  await expect(access(d.destination)).rejects.toThrow();
  await symlink(c.root, join(c.root, "link"));
  await expect(
    c.drafts.create({
      name: "bad",
      destination: join(c.root, "link"),
      engine: "codex",
    }),
  ).rejects.toThrow("symbolic");
});
it("extracts real PDF and DOCX documents with page evidence and rejects scanned PDF pages", async () => {
  const c = await fixture();
  for (const name of ["brief.pdf", "brief.docx"]) {
    const d = await c.drafts.upload(
      c.d.id,
      name,
      (await readFile(join("tests/fixtures/product-sources", name))).toString(
        "base64",
      ),
    );
    expect(d.attachments.at(-1)?.error).toBeUndefined();
    expect(d.attachments.at(-1)?.text).toContain("Catalog");
  }
  expect(c.drafts.get(c.d.id).attachments[0]?.text).toContain("Page 1");
  const d = await c.drafts.upload(
    c.d.id,
    "scanned.pdf",
    (await readFile("tests/fixtures/product-sources/scanned.pdf")).toString(
      "base64",
    ),
  );
  expect(d.attachments.at(-1)?.error).toContain("no extractable text");
});
it("rejects attachment changes after review", async () => {
  const c = await fixture();
  const d = await c.drafts.upload(
    c.d.id,
    "brief.txt",
    Buffer.from("Catalog").toString("base64"),
  );
  const running = await c.drafts.generate(d.id);
  await waitRun(c.store, running.runId!);
  await writeFile(
    join(c.drafts.directory(d), "uploads", d.attachments[0]!.id),
    "changed",
  );
  await expect(c.drafts.apply(d.id)).rejects.toThrow("Attachment changed");
  await expect(access(d.destination)).rejects.toThrow();
});
it("preserves existing specs/custom guidance and imports overlapping intent as a reviewed refinement", async () => {
  const c = await fixture();
  const destination = join(c.root, "existing");
  await mkdir(join(destination, "openspec/specs/catalog"), { recursive: true });
  await mkdir(join(destination, "openspec/project"));
  await writeFile(
    join(destination, "openspec/specs/catalog/spec.md"),
    productSpec,
  );
  await writeFile(
    join(destination, "openspec/project/mission.md"),
    "# Owner mission\nKeep this intent.",
  );
  await writeFile(join(destination, "AGENTS.md"), "Owner-specific rules.\n");
  const d = await c.drafts.create({
    name: "Existing shop",
    destination,
    engine: "codex",
    prompt: "Allow guest browsing while retaining current requirements.",
  });
  let run = await c.drafts.generate(d.id);
  expect((await waitRun(c.store, run.runId!)).error).toContain(
    "Preserve existing",
  );
  const change = `product-${d.id.slice(0, 8)}`;
  c.setTransform(() => ({
    summary: "Refine catalog",
    questions: [],
    files: [
      {
        path: `openspec/changes/${change}/specs/catalog/spec.md`,
        sourceIds: ["prompt"],
        content: productSpec
          .replace("## Requirements", "## MODIFIED Requirements")
          .replace(
            "show available products.",
            "show available products to guests without requiring an account.",
          ),
      },
      ...Object.entries({
        ".openspec.yaml": "schema: clinic-sdd\ncreated: 2026-10-18\n",
        "proposal.md":
          "# Guest access\n\n## Why\nGuests need to browse products.\n\n## What Changes\n- Permit browsing before sign-in.\n\n## Capabilities\n### New Capabilities\nNone.\n### Modified Capabilities\n- `catalog`: guest browsing.\n\n## Impact\nCatalog access rules.\n",
        "design.md": "# Design\nPreserve existing catalog and support guests.",
        "research.md":
          "# Research\nProduct prompt requests guest access; existing catalog is reused.",
        "tasks.md":
          "## Implementation\n- [ ] 1.1 Allow guest access and verify Available products.\n",
        "validation.md":
          "# Validation\n| Exact scenario title | Check | Expected evidence |\n| --- | --- | --- |\n| Available products | Guest browsing test | Products shown without account |\n",
      }).map(([name, content]) => ({
        path: `openspec/changes/${change}/${name}`,
        content,
        sourceIds: [],
      })),
    ],
  }));
  run = await c.drafts.generate(d.id);
  expect((await waitRun(c.store, run.runId!)).status).toBe("completed");
  await c.drafts.apply(d.id);
  expect(
    await readFile(join(destination, "openspec/specs/catalog/spec.md"), "utf8"),
  ).toBe(productSpec);
  expect(
    await readFile(join(destination, "openspec/project/mission.md"), "utf8"),
  ).toContain("Owner mission");
  expect(await readFile(join(destination, "AGENTS.md"), "utf8")).toContain(
    "Owner-specific rules",
  );
  expect(
    await readFile(
      join(destination, `openspec/changes/${change}/specs/catalog/spec.md`),
      "utf8",
    ),
  ).toContain("## MODIFIED Requirements");
});
it("retains multiple clarification rounds and rejects superseded answers", async () => {
  const c = await fixture();
  c.setQuestions(true);
  let run = await c.drafts.generate(c.d.id);
  await waitRun(c.store, run.runId!);
  const first = c.drafts.get(c.d.id).clarificationId!;
  run = await c.drafts.generate(c.d.id, {
    questionId: first,
    answer: "Guests can browse.",
  });
  await waitRun(c.store, run.runId!);
  const second = c.drafts.get(c.d.id).clarificationId!;
  expect(second).not.toBe(first);
  await expect(
    c.drafts.generate(c.d.id, { questionId: first, answer: "obsolete" }),
  ).rejects.toThrow("current questions");
  c.setQuestions(false);
  run = await c.drafts.generate(c.d.id, {
    questionId: second,
    answer: "Use green accessible controls.",
  });
  await waitRun(c.store, run.runId!);
  expect(c.calls.at(-1)!.prompt).toContain("Guests can browse");
  expect(c.calls.at(-1)!.prompt).toContain("green accessible");
});
