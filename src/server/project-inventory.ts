import { lstat, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Project } from "../shared/types.js";
import { assert, command, errorText, hash, redact, safePath } from "./util.js";

export const baselineReportPath = "openspec/project/baseline-analysis.md";
export const baselineReportMarker = "<!-- sdd-clinic:baseline -->";
export interface InventoryFile {
  path: string;
  hash: string;
  content: string;
  lines: number;
}
export interface ProjectInventory {
  files: InventoryFile[];
  excluded: { path: string; reason: string }[];
  fingerprint: string;
}
const excludedDirectories = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  // Native dependencies and build caches must be pruned even without Git ignores.
  "Pods",
  "DerivedData",
  ".gradle",
  ".cxx",
  ".expo",
  ".dart_tool",
  ".build",
  "vendor",
  "venv",
  ".venv",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  "target",
  "playwright-report",
  "test-results",
  ".sdd-clinic",
]);
const credentialNames =
  /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.ssh|\.aws|\.azure|credentials(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519|ecdsa))$|\.(?:pem|key|p12|pfx|keystore)$/i;

export async function inventoryProject(
  project: Pick<Project, "path">,
  signal?: AbortSignal,
  limits = { entries: 30_000, fileBytes: 2_000_000, totalBytes: 20_000_000 },
): Promise<ProjectInventory> {
  const files: InventoryFile[] = [];
  const excluded: ProjectInventory["excluded"] = [];
  const stamps: string[] = [];
  let entriesSeen = 0,
    totalBytes = 0;
  const checkCanceled = () =>
    assert(!signal?.aborted, "Project analysis interrupted.");
  let ignored: string[] = [];
  try {
    const result = await command(
      "git",
      [
        // The owner selected this project; Docker mounts may report another UID.
        // Trust only this path for this read-only command, never global Git config.
        "-c",
        `safe.directory=${project.path}`,
        "ls-files",
        "--others",
        "--ignored",
        "--exclude-standard",
        "--directory",
        "-z",
      ],
      { cwd: project.path, signal },
    );
    if (result.code === 0) ignored = result.stdout.split("\0").filter(Boolean);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const exclude = (path: string, reason: string) => {
    excluded.push({ path, reason });
    // Excluded content is never evidence; only its presence/classification participates.
    stamps.push(`${path}\0excluded:${reason}`);
  };
  const directories = [""];
  while (directories.length) {
    checkCanceled();
    const directory = directories.pop()!;
    const entries = await readdir(
      directory ? await safePath(project.path, directory) : project.path,
      { withFileTypes: true },
    );
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      checkCanceled();
      const path = directory ? `${directory}/${entry.name}` : entry.name;
      assert(
        ++entriesSeen <= limits.entries,
        `Project analysis exceeds ${limits.entries} entries. Exclude generated or dependency folders before retrying; no complete baseline was produced.`,
      );
      if (entry.isSymbolicLink()) {
        exclude(path, "symbolic link");
        continue;
      }
      if (credentialNames.test(entry.name)) {
        exclude(path, "credential file or directory");
        continue;
      }
      if (
        entry.isDirectory() &&
        (excludedDirectories.has(entry.name) || path === ".clinic/local")
      ) {
        exclude(
          path,
          "dependency, generated output or internal data directory",
        );
        continue;
      }
      if (
        ignored.some((name) =>
          name.endsWith("/") ? `${path}/`.startsWith(name) : path === name,
        )
      ) {
        exclude(path, "Git-ignored path");
        continue;
      }
      if (entry.isDirectory()) {
        directories.push(path);
        continue;
      }
      if (!entry.isFile()) {
        exclude(path, "non-regular file");
        continue;
      }
      if (/\.clinic-tmp$/.test(path)) continue;
      if (entry.name === ".git") {
        exclude(path, "Git worktree metadata");
        continue;
      }
      if (
        /\.(?:png|jpe?g|gif|webp|ico|pdf|docx?|xlsx?|pptx?|zip|gz|tar|woff2?|ttf|mp[34]|mov|exe|dll|so)$/i.test(
          entry.name,
        )
      ) {
        exclude(path, "binary document, media or archive");
        continue;
      }
      if (
        /^(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(
          entry.name,
        ) ||
        /\.(?:sqlite(?:-wal|-shm)?|db|map)$/i.test(entry.name)
      ) {
        exclude(path, "generated dependency or local data file");
        continue;
      }
      try {
        const target = await safePath(project.path, path);
        const stat = await lstat(target);
        assert(
          stat.size <= limits.fileBytes,
          `File ${path} exceeds the ${limits.fileBytes}-byte analysis limit. Exclude generated files or split the file before retrying.`,
        );
        const bytes = await readFile(target);
        let content: string;
        try {
          if (bytes.includes(0)) throw new Error("binary");
          content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch {
          exclude(path, "binary or non-UTF-8 file");
          continue;
        }
        if (
          path === baselineReportPath &&
          content.startsWith(baselineReportMarker)
        ) {
          exclude(path, "previous generated baseline report");
          continue;
        }
        totalBytes += bytes.length;
        assert(
          totalBytes <= limits.totalBytes,
          `Project text exceeds the ${limits.totalBytes}-byte analysis limit. Narrow the project or exclude generated content before retrying; no complete baseline was produced.`,
        );
        const digest = createHash("sha256").update(bytes).digest("hex");
        files.push({
          path,
          hash: digest,
          content: String(
            redact(
              content.replace(
                /-----BEGIN[^-]*PRIVATE KEY-----[\s\S]*?-----END[^-]*PRIVATE KEY-----/g,
                (key) =>
                  `[REDACTED PRIVATE KEY]${"\n".repeat(key.split("\n").length - 1)}`,
              ),
            ),
          ),
          lines: content.split("\n").length,
        });
        stamps.push(`${path}\0${digest}`);
      } catch (error) {
        throw new Error(`Cannot analyze ${path}: ${errorText(error)}`);
      }
    }
  }
  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    excluded: excluded.sort((a, b) => a.path.localeCompare(b.path)),
    fingerprint: hash(stamps.sort().join("\n")),
  };
}

export interface SourceChunk {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}
export function sourceChunks(
  files: InventoryFile[],
  size = 24_000,
): SourceChunk[] {
  const result: SourceChunk[] = [];
  for (const file of files) {
    let offset = 0,
      line = 1;
    do {
      const content = file.content.slice(offset, offset + size);
      const endLine = line + (content.match(/\n/g)?.length ?? 0);
      result.push({
        id: String(result.length + 1),
        path: file.path,
        startLine: line,
        endLine,
        content,
      });
      line = endLine;
      offset += size;
    } while (offset < file.content.length);
  }
  return result;
}

export function boundedGroups<T>(items: T[], size = 60_000): T[][] {
  const groups: T[][] = [];
  let current: T[] = [],
    length = 0;
  for (const item of items) {
    const next = JSON.stringify(item).length;
    assert(
      next <= size,
      "Analysis item exceeds the context limit. Reduce the analysis scope and retry.",
    );
    if (length + next > size && current.length) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(item);
    length += next;
  }
  if (current.length) groups.push(current);
  return groups;
}
