import {
  mkdir,
  readFile,
  writeFile,
  lstat,
  realpath,
  rm,
  readdir,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import mammoth from "mammoth";
import { z } from "zod";
import type {
  Project,
  SetupDraft,
  SetupAttachment,
  Proposal,
  EngineRequest,
} from "../shared/types.js";
import { Runs } from "./runs.js";
import {
  ask,
  answerQuestion,
  answerContext,
  clarificationInstruction,
} from "./clarification.js";
import {
  assert,
  id,
  now,
  hash,
  safePath,
  readOptional,
  parseJsonOutput,
  KeyLock,
  errorText,
  redact,
} from "./util.js";
import {
  inventoryProject,
  sourceChunks,
  boundedGroups,
} from "./project-inventory.js";

const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const inputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  destination: z.string().min(1),
  engine: z.enum(["codex", "claude"]),
  prompt: z.string().max(100000).default(""),
});
const outputSchema = z.object({
  summary: z.string(),
  questions: z.array(z.string().min(1)).default([]),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
        sourceIds: z.array(z.string()).default([]),
      }),
    )
    .max(60)
    .default([]),
});
const mimeTypes: Record<string, string> = {
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export class SetupDrafts {
  private locks = new KeyLock();
  constructor(readonly runs: Runs) {}
  get store() {
    return this.runs.store;
  }
  get(draftId: string) {
    let draft = this.store.require<SetupDraft>("setup-draft", draftId);
    if (draft.status === "running" && draft.runId) {
      const run = this.runs.get(draft.runId);
      if (["failed", "interrupted"].includes(run.status))
        draft = this.save(draft, {
          status: run.status as "failed" | "interrupted",
          error: run.error,
        });
    }
    return draft;
  }
  list() {
    return this.store
      .list<SetupDraft>("setup-draft")
      .map((d) => this.get(d.id));
  }
  save(draft: SetupDraft, patch: Partial<SetupDraft>) {
    return this.store.put("setup-draft", {
      ...draft,
      ...patch,
      updatedAt: now(),
    });
  }
  directory(draft: SetupDraft) {
    return join(this.runs.dataDir, "setup-drafts", draft.id);
  }
  async create(input: unknown) {
    const parsed = inputSchema.parse(input);
    const destination = resolve(parsed.destination);
    assert(
      parsed.destination.startsWith("/"),
      "Choose an absolute destination inside a mounted workspace.",
    );
    // Canonicalize the parent and reject symlink destinations, including newly created ones.
    const parent = await realpath(dirname(destination));
    const canonical = join(parent, basename(destination));
    let newDirectory = false;
    try {
      const stat = await lstat(canonical);
      assert(
        stat.isDirectory() && !stat.isSymbolicLink(),
        "Choose a directory, not a symbolic link.",
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      newDirectory = true;
    }
    assert(
      !this.list().some(
        (d) => d.destination === canonical && d.status !== "applied",
      ),
      "A setup draft already exists for this destination. Resume it.",
      409,
    );
    const draftId = id();
    let project: Project;
    if (newDirectory) {
      const path = join(
        this.runs.dataDir,
        "setup-drafts",
        draftId,
        "workspace",
      );
      await mkdir(path, { recursive: true });
      project = this.store.put<Project>("project", {
        id: id(),
        name: parsed.name,
        path,
        engine: parsed.engine,
        createdAt: now(),
        setupDraft: true,
      });
    } else
      project = await this.runs.projects.add(
        canonical,
        parsed.engine,
        parsed.name,
      );
    const draft: SetupDraft = {
      id: draftId,
      projectId: project.id,
      name: parsed.name,
      destination: canonical,
      newDirectory,
      engine: parsed.engine,
      prompt: parsed.prompt,
      attachments: [],
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    };
    await mkdir(join(this.directory(draft), "uploads"), { recursive: true });
    return this.store.put("setup-draft", draft);
  }
  editable(draft: SetupDraft) {
    assert(
      !["running", "applied"].includes(draft.status),
      "Wait for analysis to stop before changing this draft.",
      409,
    );
  }
  invalidate(draft: SetupDraft) {
    if (draft.proposalId) {
      const p = this.store.get<Proposal>("proposal", draft.proposalId);
      if (p?.status === "pending")
        this.store.put("proposal", { ...p, status: "rejected" });
    }
    if (draft.clarificationId) {
      const q = this.store.get<any>("clarification", draft.clarificationId);
      if (q?.status === "pending")
        this.store.put("clarification", { ...q, status: "canceled" });
    }
    return this.save(draft, {
      status: "draft",
      proposalId: undefined,
      clarificationId: undefined,
      error: undefined,
    });
  }
  update(draftId: string, prompt: string) {
    const d = this.get(draftId);
    this.editable(d);
    assert(prompt.length <= 100000, "Prompt exceeds 100,000 characters.");
    return this.save(this.invalidate(d), { prompt });
  }
  async upload(draftId: string, name: string, base64: string) {
    return this.locks.with(draftId, async () => {
      let d = this.get(draftId);
      this.editable(d);
      const ext = extname(name).toLowerCase(),
        mime = mimeTypes[ext];
      assert(mime, "Supported attachments: MD, TXT, PDF, DOCX, PNG and JPEG.");
      assert(
        base64.length <= 14_000_000 && /^[A-Za-z0-9+/]*={0,2}$/.test(base64),
        "Invalid or oversized attachment (10 MiB maximum).",
      );
      const bytes = Buffer.from(base64, "base64");
      assert(
        bytes.length > 0 && bytes.length <= 10 * 1024 * 1024,
        "Attachments must contain 1 byte–10 MiB.",
      );
      assert(
        d.attachments.length < 20 &&
          d.attachments.reduce((n, a) => n + a.bytes, 0) + bytes.length <=
            50 * 1024 * 1024,
        "Use at most 20 attachments and 50 MiB per setup.",
      );
      const a: SetupAttachment = {
        id: `${id()}${ext}`,
        name: basename(name).replace(/[^a-zA-Z0-9._-]/g, "-"),
        mime,
        bytes: bytes.length,
        hash: digest(bytes),
        text: "",
        image: mime.startsWith("image/"),
      };
      await writeFile(join(this.directory(d), "uploads", a.id), bytes, {
        mode: 0o600,
      });
      try {
        if (a.image) {
          assert(
            ext === ".png"
              ? bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              : bytes[0] === 255 &&
                  bytes[1] === 216 &&
                  bytes.at(-2) === 255 &&
                  bytes.at(-1) === 217,
            "Invalid image file.",
          );
          a.text =
            "Visual reference; image will be supplied to the selected provider.";
        } else if (ext === ".pdf") {
          const { getDocument } =
            await import("pdfjs-dist/legacy/build/pdf.mjs");
          const task = getDocument({
            data: new Uint8Array(bytes),
            useSystemFonts: false,
          });
          try {
            const pdf = await task.promise;
            assert(
              pdf.numPages <= 200,
              "PDF exceeds 200 pages; split it before uploading.",
            );
            for (let page = 1; page <= pdf.numPages; page++) {
              const text = (
                await (await pdf.getPage(page)).getTextContent()
              ).items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ");
              assert(
                text.trim(),
                `PDF page ${page} has no extractable text. Supply text or image attachments for scanned pages.`,
              );
              a.text += `\n## Page ${page}\n${text}\n`;
            }
          } finally {
            await task.destroy();
          }
        } else if (ext === ".docx") {
          a.text = (await mammoth.extractRawText({ buffer: bytes })).value;
        } else {
          assert(!bytes.includes(0), "Text file contains binary data.");
          a.text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        }
        assert(
          a.text.trim() && a.text.length <= 1_000_000,
          "No extractable text, or text exceeds 1 million characters. Split the document or supply text.",
        );
      } catch (e) {
        a.error = errorText(e);
      }
      d = this.invalidate(this.get(draftId));
      return this.save(d, { attachments: [...d.attachments, a] });
    });
  }
  async remove(draftId: string, attachmentId: string) {
    return this.locks.with(draftId, async () => {
      let d = this.get(draftId);
      this.editable(d);
      assert(
        d.attachments.some((a) => a.id === attachmentId),
        "Attachment not found.",
        404,
      );
      d = this.invalidate(d);
      await rm(join(this.directory(d), "uploads", attachmentId));
      return this.save(d, {
        attachments: d.attachments.filter((a) => a.id !== attachmentId),
      });
    });
  }
  async bytes(draftId: string, attachmentId: string) {
    const d = this.get(draftId),
      a = d.attachments.find((a) => a.id === attachmentId);
    assert(a, "Attachment not found.", 404);
    return {
      attachment: a,
      bytes: await readFile(join(this.directory(d), "uploads", a.id)),
    };
  }
  async generate(
    draftId: string,
    answer?: { questionId: string; answer: string },
  ) {
    return this.locks.with(draftId, async () => {
      let d = this.get(draftId);
      this.editable(d);
      if (d.newDirectory) {
        const destination = await lstat(d.destination).catch((error) => {
          if (error.code === "ENOENT") return undefined;
          throw error;
        });
        if (destination) {
          assert(
            destination.isDirectory() && !destination.isSymbolicLink(),
            "Choose a directory, not a symbolic link.",
          );
          assert(
            (await realpath(d.destination)) === d.destination,
            "Destination changed. Create a draft for its current location.",
            409,
          );
          assert(
            !this.store
              .list<Project>("project")
              .some((p) => p.id !== d.projectId && p.path === d.destination),
            "Destination is already registered. Use its existing project setup.",
            409,
          );
          this.store.put("project", {
            ...this.runs.projects.get(d.projectId),
            path: d.destination,
            setupDraft: false,
          });
          d = this.save(d, { newDirectory: false });
        }
      }
      const project = {
        ...this.runs.projects.get(d.projectId),
        engine: d.engine,
      };
      assert(
        d.prompt.trim() || d.attachments.length,
        "Enter a prompt or attach a product document.",
      );
      assert(
        !d.attachments.some((a) => a.error),
        "Remove or replace unreadable attachments before generating specs.",
      );
      if (d.status === "needs-input") {
        assert(
          answer && answer.questionId === d.clarificationId,
          "Answer the current questions before continuing.",
          409,
        );
        answerQuestion(
          this.store,
          project,
          answer.questionId,
          answer.answer,
          d.id,
        );
      }
      const run = this.runs.productSetup(
        project,
        async (invoke, signal, run) => {
          try {
            const inventory = await inventoryProject(project, signal);
            const allSources = [
              ...(d.prompt.trim()
                ? [{ path: "prompt", content: d.prompt }]
                : []),
              ...d.attachments
                .filter((a) => !a.image)
                .map((a) => ({ path: a.id, content: a.text })),
              ...inventory.files
                .filter((f) => f.path.startsWith("openspec/"))
                .map((f) => ({ path: f.path, content: f.content })),
            ];
            const chunks = sourceChunks(
              allSources.map((s) => ({
                ...s,
                content: String(redact(s.content)),
                hash: hash(s.content),
                lines: s.content.split("\n").length,
              })),
            );
            const findings: string[] = [];
            const answers = answerContext(
              this.store,
              project.id,
              undefined,
              d.id,
            );
            for (const batch of boundedGroups(chunks)) {
              assert(!signal.aborted, "Setup interrupted.");
              const result = z
                .object({
                  reviewed: z.array(z.string()),
                  findings: z.string().max(30000),
                })
                .parse(
                  parseJsonOutput(
                    await invoke(
                      `CLINIC_PRODUCT_SOURCES\n${clarificationInstruction}\nAnalyze all supplied text as product evidence. Return JSON {"reviewed":[every chunk id exactly once],"findings":"requirements, UI/UX constraints, conflicts, source IDs and questions"}. Do not drop distinct behavior.\nAnswers: ${answers}\nSOURCES\n${JSON.stringify(batch)}`,
                    ),
                  ),
                );
              assert(
                result.reviewed.length === batch.length &&
                  new Set(result.reviewed).size === batch.length &&
                  batch.every((c) => result.reviewed.includes(c.id)),
                "Analysis omitted a source chunk. Retry; no complete proposal was produced.",
              );
              findings.push(result.findings);
              this.store.append(run.id, "progress", {
                message: `Analyzed ${result.reviewed.length} source chunks.`,
              });
            }
            for (const a of d.attachments.filter((a) => a.image)) {
              const result = await invoke(
                `CLINIC_PRODUCT_IMAGE\n${clarificationInstruction}\nDescribe this UI/UX reference as evidence, separating explicit visual constraints from interpretations and uncertainties. Reference source ID ${a.id} (${a.name}). Return concise text.`,
                [
                  {
                    path: join(this.directory(d), "uploads", a.id),
                    mime: a.mime as "image/png" | "image/jpeg",
                  },
                ],
              );
              findings.push(result);
            }
            assert(
              findings.join("\n").length <= 180000,
              "Source findings exceed the synthesis limit. Split the project brief and retry; no content was silently truncated.",
            );
            const sourceIds = [
              ...(d.prompt.trim() ? ["prompt"] : []),
              ...d.attachments.map((a) => a.id),
              ...inventory.files.map((f) => f.path),
            ];
            const result = outputSchema.parse(
              parseJsonOutput(
                await invoke(
                  `CLINIC_PRODUCT_SYNTHESIZE\n${clarificationInstruction}\nCreate a new project's intended SDD baseline, not code. Return {"summary":"...","questions":[],"files":[{"path":"...","content":"complete Markdown","sourceIds":["supporting source IDs"]}]}. If product decisions block a reliable specification, return questions and no final files. Generate native openspec/specs/<capability>/spec.md with # title, ## Purpose, ## Requirements, ### Requirement: titles, SHALL behavior and #### Scenario: WHEN/THEN cases. Label intended behavior unimplemented/unverified. Only create missing project guidance; preserve existing customized documents. Include missing openspec/project/mission.md, tech-stack.md (leave unstated choices open), roadmap.md and ui-ux.md. Do not invent product decisions or tests. Preserve existing files. Overlapping existing intent must be refined in openspec/changes/product-${d.id.slice(0, 8)}/ with proposal/design/research/validation/tasks/.openspec.yaml and native delta specs; never overwrite accepted specs or duplicate intent. Cite source IDs in every spec. Include all generated scenarios in validation plans.\nExisting paths: ${JSON.stringify(inventory.files.map((f) => f.path))}\nAllowed source IDs: ${JSON.stringify(sourceIds)}\nClarification answers: ${answers}\nFindings:\n${findings.join("\n\n")}`,
                ),
              ),
            );
            if (result.questions.length) {
              const q = ask(this.store, {
                projectId: project.id,
                ownerId: d.id,
                stage: "setup",
                questions: result.questions,
              });
              this.save(this.get(d.id), {
                status: "needs-input",
                clarificationId: q.id,
              });
              return;
            }
            assert(
              result.files.length,
              "No project specifications were generated.",
            );
            const setup = await this.runs.projects.setupFiles(project);
            const files: {
              path: string;
              after: string;
              encoding?: "base64";
            }[] = setup.files.map((f) => ({ ...f }));
            for (const f of result.files) {
              assert(
                /^openspec\/(?:project\/(?:mission|tech-stack|roadmap|ui-ux)\.md|specs\/[a-z0-9-]+\/spec\.md|changes\/product-[a-z0-9]+\/(?:[a-z0-9.-]+\.(?:md|yaml)|specs\/[a-z0-9-]+\/spec\.md))$/.test(
                  f.path,
                ),
                "Generated output has an unsupported path.",
              );
              assert(
                (await readOptional(await safePath(project.path, f.path))) ===
                  null,
                `Preserve existing ${f.path}. Regenerate using a refinement change.`,
              );
              if (f.path.endsWith("/spec.md"))
                assert(
                  f.sourceIds.length &&
                    f.sourceIds.every((s) => sourceIds.includes(s)),
                  "Generated spec has missing or unknown evidence references.",
                );
              const at = files.findIndex((old) => old.path === f.path);
              if (at >= 0) files.splice(at, 1);
              files.push({
                path: f.path,
                after:
                  f.content +
                  (f.sourceIds.length
                    ? `\n\nSource IDs: ${f.sourceIds.join(", ")}. Intended behavior; implementation and validation unverified.\n`
                    : ""),
              });
            }
            assert(
              files.some((f) => /\/specs\/.+\/spec\.md$/.test(f.path)),
              "Setup must contain a capability spec or a refinement change.",
            );
            for (const a of d.attachments) {
              const bytes = (await this.bytes(d.id, a.id)).bytes;
              assert(
                digest(bytes) === a.hash,
                "An attachment changed; upload it again.",
              );
              files.push({
                path: `openspec/project/sources/${a.id}-${a.name}`,
                after: bytes.toString("base64"),
                encoding: "base64",
              });
            }
            files.push({
              path: `openspec/project/sources/brief-${d.id}.md`,
              after: `# Product source record\n\n## Prompt\n${d.prompt}\n\n## Decisions\n${answers}\n\n## Attachments\n${d.attachments.map((a) => `- ${a.id}: ${a.name}; SHA256 ${a.hash}`).join("\n")}\n\n## Review\n${result.summary}\nIntended behavior; no application implementation or tests were performed.\n`,
            });
            const validation = join(this.directory(d), "validation");
            await rm(validation, { recursive: true, force: true });
            await mkdir(validation, { recursive: true });
            for (const f of inventory.files.filter((f) =>
              f.path.startsWith("openspec/"),
            )) {
              const path = await safePath(validation, f.path);
              await mkdir(dirname(path), { recursive: true });
              await writeFile(path, f.content);
            }
            for (const f of files.filter((f) => !f.encoding)) {
              const path = await safePath(validation, f.path);
              await mkdir(dirname(path), { recursive: true });
              await writeFile(path, f.after);
            }
            const checked = await this.runs.specs.openSpec(validation, [
              "validate",
              "--all",
              "--strict",
            ]);
            assert(
              checked.code === 0,
              `Generated specs failed validation: ${checked.stdout || checked.stderr}`,
            );
            assert(
              (await inventoryProject(project, signal)).fingerprint ===
                inventory.fingerprint,
              "Project changed during analysis; regenerate the proposal.",
            );
            const proposal = await this.runs.specs.propose(
              project,
              "Review new project SDD package",
              files,
              "product",
            );
            this.store.put("proposal", {
              ...proposal,
              setupDraftId: d.id,
              inventoryHash: inventory.fingerprint,
            });
            this.save(this.get(d.id), {
              status: "review",
              proposalId: proposal.id,
              clarificationId: undefined,
            });
          } catch (e) {
            this.save(this.get(d.id), {
              status: signal.aborted ? "interrupted" : "failed",
              error: errorText(e),
            });
            throw e;
          }
        },
      );
      d = this.save(this.get(d.id), {
        status: "running",
        runId: run.id,
        error: undefined,
      });
      return d;
    });
  }
  async cancel(draftId: string) {
    const d = this.get(draftId);
    if (d.runId && this.runs.active.has(d.runId)) this.runs.cancel(d.runId);
    return this.save(d, { status: "interrupted" });
  }
  async apply(draftId: string) {
    return this.locks.with(draftId, async () => {
      const d = this.get(draftId);
      assert(
        d.status === "review" && d.proposalId,
        "Generate and review the setup first.",
        409,
      );
      const project = this.runs.projects.get(d.projectId),
        proposal = this.store.require<Proposal>(
          "proposal",
          d.proposalId,
          project.id,
        );
      assert(
        (await inventoryProject(project)).fingerprint ===
          proposal.inventoryHash,
        "Project changed after review. Regenerate before applying.",
        409,
      );
      assert(
        (await realpath(dirname(d.destination))) === dirname(d.destination),
        "Destination parent changed; regenerate setup.",
        409,
      );
      for (const a of d.attachments)
        assert(
          digest((await this.bytes(d.id, a.id)).bytes) === a.hash,
          "Attachment changed after review. Upload it again and regenerate.",
          409,
        );
      let created = false;
      try {
        if (d.newDirectory) {
          await mkdir(d.destination);
          created = true;
        } else
          assert(
            (await realpath(d.destination)) === project.path,
            "Destination changed after review.",
            409,
          );
        const target = { ...project, path: d.destination, setupDraft: false };
        await this.runs.specs.apply(target, proposal.id, true);
        this.store.put("project", target);
        return this.save(d, { status: "applied" });
      } catch (e) {
        if (created && !(await readdir(d.destination)).length)
          await rm(d.destination, { recursive: true });
        throw e;
      }
    });
  }
}
