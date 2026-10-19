import { setupReviewPath, setupReviewMarker } from "./setup-quality.js";
import { completeSetupDocuments } from "./setup-documents.js";
import { reconstructionPath, reconstructionMarker } from "./reconstruction.js";
import { requireClearIntent } from "./clarification.js";
import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { createTwoFilesPatch } from "diff";
import { stringify } from "yaml";
import { agentInstructionPaths } from "./agent-instructions.js";
import {
  baselineReportMarker,
  baselineReportPath,
  inventoryProject,
} from "./project-inventory.js";
import {
  artifactTemplates,
  changeSchema,
  clinicSchema,
  draftMarker,
  projectDocumentNames,
  schemaSupportFiles,
} from "./documentation.js";
import type {
  ChangeRecord,
  FileEdit,
  Project,
  Proposal,
  SpecFile,
} from "../shared/types.js";
import { Store } from "./store.js";
import {
  assert,
  atomicWrite,
  command,
  hash,
  id,
  KeyLock,
  now,
  readOptional,
  safeName,
  safePath,
} from "./util.js";

export class SpecRepository {
  private locks = new KeyLock();
  constructor(readonly store: Store) {}
  async list(project: Project): Promise<SpecFile[]> {
    const result: SpecFile[] = [];
    const walk = async (path: string, depth = 0) => {
      if (depth > 12 || result.length > 2000) return;
      const target = await safePath(project.path, path);
      let entries;
      try {
        entries = await readdir(target, { withFileTypes: true });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
        throw e;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const child = `${path}/${entry.name}`;
        if (entry.isDirectory()) await walk(child, depth + 1);
        else if (entry.isFile() && /\.md$/.test(entry.name)) {
          const content = await readOptional(
            await safePath(project.path, child),
          );
          if (content === null) continue;
          const parts = child.split("/");
          const kind =
            parts[1] === "project"
              ? "project"
              : parts[1] === "specs"
                ? "spec"
                : parts[2] === "archive"
                  ? "archive"
                  : "change";
          result.push({
            path: child,
            name:
              entry.name === "spec.md"
                ? parts
                    .slice(kind === "spec" ? 2 : kind === "archive" ? 4 : 3, -1)
                    .join(" / ")
                : entry.name.replace(/\.md$/, ""),
            kind,
            change: kind === "change" ? parts[2] : undefined,
            content,
            hash: hash(content),
          });
        }
      }
    };
    await walk("openspec/project");
    await walk("openspec/specs");
    await walk("openspec/changes");
    return result.sort((a, b) => a.path.localeCompare(b.path));
  }
  async file(project: Project, path: string) {
    assert(
      path.startsWith("openspec/"),
      "Only OpenSpec files can be opened here.",
    );
    const content = await readOptional(await safePath(project.path, path));
    assert(content !== null, "Specification not found.", 404);
    return { path, content, hash: hash(content) };
  }
  async snapshot(project: Project, name: string) {
    safeName(name);
    const allFiles = await this.list(project);
    const files = allFiles.filter((f) => f.change === name);
    const metadata = await readOptional(
      await safePath(project.path, `openspec/changes/${name}/.openspec.yaml`),
    );
    assert(files.length > 0, "Change has no Markdown artifacts.");
    const support = await schemaSupportFiles(project);
    return {
      files,
      hash: hash(
        [
          ...files,
          ...allFiles.filter((f) => f.kind === "spec" || f.kind === "project"),
        ]
          .map(
            (f) =>
              `${f.path}\0${f.path.endsWith("/tasks.md") ? hash(f.content.replace(/\[[xX]\]/g, "[ ]")) : f.hash}`,
          )
          .join("\n") +
          `\nmetadata:${metadata ?? ""}\n` +
          support.map((f) => `${f.path}\0${hash(f.content)}`).join("\n"),
      ),
    };
  }
  change(project: Project, name: string) {
    safeName(name);
    const key = `${project.id}:${name}`;
    return (
      this.store.get<ChangeRecord>("change", key) ??
      ({
        id: key,
        projectId: project.id,
        name,
        state: "draft",
        updatedAt: now(),
      } satisfies ChangeRecord)
    );
  }
  async changes(project: Project) {
    const names = [
      ...new Set(
        (await this.list(project)).flatMap((f) => (f.change ? [f.change] : [])),
      ),
    ];
    const records = names.map((n) => this.change(project, n));
    for (const c of this.store.list<ChangeRecord>("change", project.id))
      if (!names.includes(c.name)) records.push(c);
    return records;
  }
  async refreshApproval(project: Project, name: string) {
    const change = this.change(project, name);
    if (
      change.approvedHash &&
      !["done", "ready-to-integrate"].includes(change.state)
    ) {
      const snapshot = await this.snapshot(project, name);
      if (snapshot.hash !== change.approvedHash) {
        change.approvedHash = undefined;
        change.qaRunId = undefined;
        change.state = "draft";
        this.store.put("change", change);
      }
    }
    return change;
  }
  private allowed(
    path: string,
    source: Proposal["source"],
    change?: string,
  ): boolean {
    if (source === "baseline")
      return (
        /^openspec\/specs\/[a-z0-9][a-z0-9-]{0,70}\/(spec|validation)\.md$/.test(
          path,
        ) ||
        path === baselineReportPath ||
        path === setupReviewPath ||
        path === reconstructionPath ||
        this.allowed(path, "setup")
      );
    if (source === "setup")
      return (
        /^openspec\/specs\/[a-z0-9][a-z0-9-]{0,70}\/validation\.md$/.test(
          path,
        ) ||
        [
          ...agentInstructionPaths,
          "CHANGELOG.md",
          "openspec/config.yaml",
          ".clinic/project.yaml",
          ...projectDocumentNames.map((name) => `openspec/project/${name}.md`),
        ].includes(path) ||
        /^openspec\/schemas\/clinic-sdd\/(schema\.yaml|templates\/(research|proposal|spec|design|validation|tasks)\.md)$/.test(
          path,
        ) ||
        /^\.clinic\/agents\/[a-z0-9-]+\.yaml$/.test(path) ||
        /^(\.clinic|\.agents|\.claude)\/skills\/[a-z0-9-]+\/SKILL\.md$/.test(
          path,
        )
      );
    if (source === "product")
      return (
        this.allowed(path, "setup") ||
        /^openspec\/project\/[a-z0-9-]+\.md$/.test(path) ||
        /^openspec\/project\/sources\/[a-zA-Z0-9._-]+$/.test(path) ||
        /^openspec\/specs\/[a-z0-9-]+\/spec\.md$/.test(path) ||
        /^openspec\/changes\/[a-z0-9-]+\/(?:[a-z0-9.-]+\.(?:md|yaml)|specs\/[a-z0-9-]+\/spec\.md)$/.test(
          path,
        )
      );
    if (source === "manual" && !change)
      return (
        /^openspec\/project\/[a-z0-9-]+\.md$/.test(path) ||
        /^openspec\/specs\/[a-z0-9/-]+\/(design|validation)\.md$/.test(path)
      );
    return (
      !!change &&
      path.startsWith(`openspec/changes/${safeName(change)}/`) &&
      /\.(md|yaml|yml)$/.test(path) &&
      !path.split("/").some((p) => p === ".." || p === "." || p === "archive")
    );
  }
  async propose(
    project: Project,
    title: string,
    files: {
      path: string;
      after: string;
      beforeHash?: string | null;
      encoding?: "base64";
    }[],
    source: Proposal["source"],
    change?: string,
    contextBases?: { path: string; hash: string }[],
  ) {
    if (
      change &&
      source !== "setup" &&
      (await changeSchema(project, change)) === clinicSchema
    ) {
      const prefix = `openspec/changes/${safeName(change)}`;
      const metadataPath = `${prefix}/.openspec.yaml`;
      const existingMetadata = await readOptional(
        await safePath(project.path, metadataPath),
      );
      files = [...files];
      if (!existingMetadata) {
        files = files.filter((f) => f.path !== metadataPath);
        files.push({
          path: metadataPath,
          after: stringify({
            schema: clinicSchema,
            created: now().slice(0, 10),
          }),
        });
      }
      for (const [file, after] of Object.entries(artifactTemplates)) {
        if (file === "spec.md") continue;
        const path = `${prefix}/${file}`;
        if (
          !files.some((f) => f.path === path) &&
          (await readOptional(await safePath(project.path, path))) === null
        )
          files.push({ path, after });
      }
    }
    if (["setup", "baseline", "product"].includes(source)) {
      const complete = await completeSetupDocuments(project.path, files);
      files = complete.files.map((f) => ({
        ...files.find((original) => original.path === f.path),
        ...f,
      }));
      contextBases = [...(contextBases ?? []), ...complete.bases];
    }
    const maxFiles = ["setup", "baseline", "product"].includes(source)
      ? 200
      : 100;
    assert(
      files.length > 0 && files.length <= maxFiles,
      `A proposal must contain 1–${maxFiles} files.`,
    );
    assert(
      new Set(files.map((f) => f.path)).size === files.length,
      "Duplicate proposal paths.",
    );
    const edits: FileEdit[] = [];
    for (const f of files) {
      assert(
        this.allowed(f.path, source, change),
        "The proposal attempts to modify a file outside its change.",
      );
      assert(
        f.after.length <= (f.encoding ? 14_000_000 : 500000),
        "Proposed file exceeds its size limit.",
      );
      assert(
        !f.encoding ||
          (source === "product" &&
            f.path.startsWith("openspec/project/sources/")),
        "Binary files must be product source attachments.",
      );
      const before = await proposalContent(
        await safePath(project.path, f.path),
        f.encoding,
      );
      if (
        source === "product" &&
        f.path !== setupReviewPath &&
        !this.allowed(f.path, "setup")
      )
        assert(
          before === null,
          `Preserve existing ${f.path}; use a refinement change.`,
        );
      if (source === "baseline" && f.path.startsWith("openspec/specs/"))
        assert(
          before === null,
          `Baseline setup cannot overwrite ${f.path}. Refine the existing specification instead.`,
        );
      if (
        ["baseline", "product"].includes(source) &&
        f.path === setupReviewPath
      )
        assert(
          before === null || before.startsWith(setupReviewMarker),
          "Preserve the customized setup quality report.",
        );
      if (source === "baseline" && f.path === reconstructionPath)
        assert(
          before === null || before.startsWith(reconstructionMarker),
          "Preserve the customized reconstruction guide.",
        );
      if (source === "baseline" && f.path === baselineReportPath)
        assert(
          before === null || before.startsWith(baselineReportMarker),
          "Preserve the customized baseline report before generating a replacement.",
        );
      const beforeHash = before === null ? null : hash(before);
      if (f.beforeHash !== undefined)
        assert(
          beforeHash === f.beforeHash,
          "The file changed since it was opened. Reload and compare your edit.",
          409,
        );
      if (before === f.after) continue;
      edits.push({
        path: f.path,
        before,
        encoding: f.encoding,
        beforeHash,
        after: f.after,
        diff: createTwoFilesPatch(
          f.path,
          f.path,
          before ?? "",
          f.after,
          "current",
          "proposed",
        ),
      });
    }
    assert(edits.length > 0, "No changes to apply.");
    return this.store.put<Proposal>("proposal", {
      id: id(),
      projectId: project.id,
      title,
      files: edits,
      source,
      change,
      contextBases,
      status: "pending",
      createdAt: now(),
    });
  }
  async apply(project: Project, proposalId: string, productSetup = false) {
    return this.locks.with(project.id, async () => {
      const proposal = this.store.require<Proposal>(
        "proposal",
        proposalId,
        project.id,
      );
      assert(
        proposal.status === "pending",
        "This proposal was already resolved.",
        409,
      );
      assert(
        proposal.source !== "product" || productSetup,
        "Apply this package through its setup draft.",
        409,
      );
      const staged: { edit: FileEdit; target: string; temp: string }[] = [];
      const applied: typeof staged = [];
      try {
        if (proposal.source === "baseline") {
          assert(
            proposal.inventoryHash,
            "Baseline proposal has no source fingerprint. Regenerate it before applying.",
          );
          assert(
            (await inventoryProject(project)).fingerprint ===
              proposal.inventoryHash,
            "Project sources changed outside Clinic. Nothing was applied. Reanalyze the current project.",
            409,
          );
        }
        for (const base of proposal.contextBases ?? []) {
          const file = await this.file(project, base.path);
          assert(
            file.hash === base.hash,
            `Context changed outside Clinic: ${base.path}. Regenerate the proposal.`,
            409,
          );
        }
        if (
          proposal.files.some(
            (f) => f.path === "CHANGELOG.md" && f.beforeHash === null,
          )
        ) {
          assert(
            !(await readdir(project.path)).some(
              (n) => n.toLowerCase() === "changelog.md",
            ),
            "A changelog appeared during review. Regenerate the proposal.",
            409,
          );
        }
        for (const edit of proposal.files) {
          assert(
            this.allowed(edit.path, proposal.source, proposal.change),
            "Invalid proposal path.",
          );
          const target = await safePath(project.path, edit.path);
          const current = await proposalContent(target, edit.encoding);
          assert(
            (current === null ? null : hash(current)) === edit.beforeHash,
            `File changed outside Clinic: ${edit.path}. Nothing was applied.`,
            409,
          );
          staged.push({ edit, target, temp: `${target}.${id()}.clinic-tmp` });
        }
        for (const file of staged) {
          await mkdir(dirname(file.target), { recursive: true });
          await writeFile(
            file.temp,
            file.edit.encoding
              ? Buffer.from(file.edit.after, "base64")
              : file.edit.after,
            {
              flag: "wx",
              mode: 0o644,
            },
          );
        }
        // Recheck all bases after staging and before the first replacement.
        for (const file of staged) {
          const current = await proposalContent(
            await safePath(project.path, file.edit.path),
            file.edit.encoding,
          );
          assert(
            (current === null ? null : hash(current)) === file.edit.beforeHash,
            "A file changed while staging this proposal. Nothing was applied.",
            409,
          );
        }
        const { rename } = await import("node:fs/promises");
        for (const file of staged) {
          await rename(file.temp, file.target);
          applied.push(file);
        }
      } catch (e) {
        for (const file of applied.reverse()) {
          if (file.edit.before === null) await rm(file.target, { force: true });
          else await atomicWrite(file.target, file.edit.before, 0o644);
        }
        throw e;
      } finally {
        for (const file of staged) await rm(file.temp, { force: true });
      }
      this.store.put("proposal", { ...proposal, status: "applied" });
      if (proposal.change) {
        const change = this.change(project, proposal.change);
        this.store.put("change", {
          ...change,
          state: "draft",
          approvedHash: undefined,
          qaRunId: undefined,
          updatedAt: now(),
        });
      }
      return { ...proposal, status: "applied" };
    });
  }
  async createChange(
    project: Project,
    name: string,
    title: string,
    description: string,
    capability = name,
  ) {
    safeName(name);
    safeName(capability);
    const existing = (await this.list(project)).some((f) => f.change === name);
    assert(!existing, "A change with this name already exists.", 409);
    const schema = await changeSchema(project);
    const current = await readOptional(
      await safePath(project.path, `openspec/specs/${capability}/spec.md`),
    );
    const prefix = `openspec/changes/${name}`;
    const files = Object.entries(artifactTemplates).map(([file, after]) => ({
      path:
        file === "spec.md"
          ? `${prefix}/specs/${capability}/spec.md`
          : `${prefix}/${file}`,
      after:
        file === "proposal.md"
          ? `# ${title}\n\n${draftMarker} Refine the full bundle before approval.\n\n## Why\n${description}\n\n## What Changes\nDefine the requested behavior and non-goals.\n\n## Capabilities\n### New Capabilities\n${current ? "None." : `- ${capability}: draft intent for review.`}\n### Modified Capabilities\n${current ? `- ${capability}: review changes against existing requirements.` : "None."}\n\n## Impact\nAssess implementation, interfaces and validation.\n`
          : file === "spec.md" && current
            ? `${draftMarker} Refine only the requested behavior and preserve unrelated scenarios.\n\n## MODIFIED Requirements\n\n${current.slice(current.indexOf("### Requirement:"))}`
            : after,
    }));
    files.push({
      path: `${prefix}/.openspec.yaml`,
      after: stringify({ schema, created: now().slice(0, 10) }),
    });
    return this.propose(project, title, files, "manual", name);
  }
  async validate(project: Project, name?: string) {
    const args = name
      ? ["validate", safeName(name), "--strict", "--json"]
      : ["validate", "--all", "--strict", "--json"];
    return this.openSpec(project.path, args);
  }
  async approve(project: Project, name: string) {
    requireClearIntent(this.store, project.id, name);
    if ((await changeSchema(project, name)) === clinicSchema) {
      const bundle = (await this.list(project)).filter(
        (f) => f.change === name,
      );
      for (const required of [
        "research.md",
        "proposal.md",
        "design.md",
        "validation.md",
        "tasks.md",
      ])
        assert(
          bundle.some(
            (f) =>
              f.path === `openspec/changes/${name}/${required}` &&
              f.content.trim(),
          ),
          `Create ${required} before implementation.`,
        );
      const drafts = bundle.filter((f) => f.content.includes(draftMarker));
      assert(
        !drafts.length,
        `Complete draft artifacts before approval: ${drafts.map((f) => f.path.split("/").at(-1)).join(", ")}`,
      );
      const scenarios = bundle
        .filter((f) => /\/specs\/.+\/spec\.md$/.test(f.path))
        .flatMap((f) =>
          [...f.content.matchAll(/^#### Scenario:\s*(.+)$/gm)].map((m) =>
            m[1]!.trim(),
          ),
        );
      const plan = bundle.find((f) =>
        f.path.endsWith("/validation.md"),
      )!.content;
      const rows = plan
        .split("\n")
        .filter((line) => /^\s*\|/.test(line))
        .map((line) =>
          line
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim()),
        );
      const missing = scenarios.filter(
        (scenario) =>
          !rows.some((row) => row[0] === scenario && row[1] && row[2]),
      );
      assert(
        !missing.length,
        `validation.md needs a scenario/check/expected-evidence row for: ${missing.join(", ")}`,
      );
    }
    const check = await this.validate(project, name);
    assert(
      check.code === 0,
      `OpenSpec validation failed:\n${check.stdout || check.stderr}`,
    );
    const snapshot = await this.snapshot(project, name);
    for (const file of snapshot.files.filter((file) =>
      /\/specs\/[^/]+\/spec\.md$/.test(file.path),
    )) {
      const capability = file.path.split("/").at(-2)!;
      const accepted = await readOptional(
        await safePath(project.path, `openspec/specs/${capability}/spec.md`),
      );
      if (accepted === null) {
        const purpose =
          file.content
            .match(/^## Purpose\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1]
            ?.trim() ?? "";
        assert(
          purpose.length >= 20 &&
            !/\b(TBD|TODO)\b|created by archiving change/i.test(purpose),
          `New capability ${capability} needs a meaningful ## Purpose section before approval.`,
        );
      }
    }
    for (const required of ["proposal.md", "design.md", "tasks.md"])
      assert(
        snapshot.files.some(
          (f) => f.path === `openspec/changes/${name}/${required}`,
        ),
        `Create ${required} before implementation.`,
      );
    const change = this.change(project, name);
    assert(
      !["developing", "qa"].includes(change.state),
      "Wait for the active run before approving a new revision.",
      409,
    );
    return this.store.put("change", {
      ...change,
      state: "ready",
      approvedHash: snapshot.hash,
      qaRunId: undefined,
      updatedAt: now(),
    });
  }
  async openSpec(cwd: string, args: string[]) {
    const require = createRequire(import.meta.url);
    const entryPath = require.resolve("@fission-ai/openspec");
    const executable = join(dirname(dirname(entryPath)), "bin/openspec.js");
    return command(process.execPath, [executable, ...args], {
      cwd,
      timeout: 30000,
      env: { ...process.env, OPENSPEC_TELEMETRY: "0", DO_NOT_TRACK: "1" },
    });
  }
}

async function proposalContent(
  path: string,
  encoding?: "base64",
): Promise<string | null> {
  if (!encoding) return readOptional(path);
  try {
    return (await readFile(path)).toString("base64");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
