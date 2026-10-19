import type {
  InventoryFile,
  ProjectInventory,
  SourceChunk,
} from "./project-inventory.js";
import { assert } from "./util.js";

export const overviewBudget = 36_000;
// Balance evidence classes before spending the remaining budget on any one file.
function category(path: string) {
  if (
    /^(?:readme|product|requirements)\.(?:md|txt)$/i.test(path) ||
    /^(?:docs|documentation)\//.test(path)
  )
    return 0;
  if (
    /(?:^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|Gemfile|composer\.json)$/.test(
      path,
    )
  )
    return 1;
  if (/(?:test|spec|__tests__)(?:[/.\-_]|$)/i.test(path)) return 2;
  if (/\.sql$|(?:^|\/)(?:models?|schema|migrations?)\//i.test(path)) return 3;
  if (
    /\.(?:tsx|jsx|vue|svelte|swift|kt)$|(?:components|screens|views)\//i.test(
      path,
    )
  )
    return 4;
  if (/\.(?:ts|js|py|rs|go|java|php|rb)$/i.test(path)) return 5;
  return 6;
}

// Static module declarations may omit semicolons. Never scan past executable
// code looking for a terminator: a source window must not lose the first tests.
export function modulePreambleLines(content: string) {
  const lines = content.split("\n");
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor]!.trim();
    if (!line || line.startsWith("//")) {
      cursor++;
      continue;
    }
    if (
      !/^import(?:\s|["'])/.test(line) &&
      !/^export\s+(?:type\s+)?(?:\*|\{)/.test(line)
    )
      break;
    let end = cursor;
    while (
      end < Math.min(lines.length, cursor + 50) &&
      !/["'][^"']+["']\s*;?\s*(?:\/\/.*)?$/.test(lines[end]!)
    )
      end++;
    if (end >= Math.min(lines.length, cursor + 50)) break;
    cursor = end + 1;
  }
  return cursor;
}

export function setupOverview(inventory: ProjectInventory): SourceChunk[] {
  const mandatory = inventory.files.filter(
    (f) =>
      /^openspec\/specs\/.*\.md$/.test(f.path) ||
      /^openspec\/changes\/(?!archive\/).+\.md$/.test(f.path) ||
      /^openspec\/project\/(?!baseline-analysis|setup-review|reconstruction).+\.md$/.test(
        f.path,
      ),
  );
  let remaining = overviewBudget;
  const selected: SourceChunk[] = [];
  const used = new Map<string, Set<number>>();
  const add = (file: InventoryFile, start: number, end: number) => {
    const lines = file.content.split("\n");
    const content = lines.slice(start, end).join("\n");
    if (content.length > remaining) return false;
    selected.push({
      id: String(selected.length + 1),
      path: file.path,
      content,
      startLine: start + 1,
      endLine: end,
    });
    const seen = used.get(file.path) ?? new Set<number>();
    for (let i = start; i < end; i++) seen.add(i);
    used.set(file.path, seen);
    remaining -= content.length;
    return true;
  };
  for (const file of mandatory) {
    assert(
      file.content.length <= remaining,
      "Existing specification intent exceeds the initial setup context limit. Run sddclinic setup --deep to preserve and reconcile all existing specifications.",
    );
    add(file, 0, file.content.split("\n").length);
  }
  const ordinary = inventory.files.filter(
    (f) =>
      !mandatory.includes(f) &&
      !/^(?:\.clinic\/|\.agents\/|\.claude\/|\.cursor\/|\.github\/|openspec\/)/.test(
        f.path,
      ) &&
      !/^(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(f.path),
  );
  const groups = Array.from({ length: 7 }, (_, group) =>
    ordinary
      .filter((f) => category(f.path) === group)
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
  const ordered: InventoryFile[] = [];
  while (groups.some((g) => g.length))
    for (const group of groups) {
      const file = group.shift();
      if (file) ordered.push(file);
    }
  // One representative window per file before additional windows. For code, skip
  // import-only preambles; later rounds sample middle/tail behavior as well.
  for (let round = 0; round < 3 && remaining > 0; round++) {
    for (const file of ordered) {
      const lines = file.content.split("\n");
      const seen = used.get(file.path);
      if (seen?.size === lines.length) continue;
      if (
        round === 0 &&
        file.content.length <= 1600 &&
        add(file, 0, lines.length)
      )
        continue;
      let start =
        round === 0
          ? 0
          : round === 1
            ? Math.floor(lines.length / 2)
            : Math.max(0, lines.length - 30);
      if (round === 0 && /\.[jt]sx?$/.test(file.path)) {
        start = modulePreambleLines(file.content);
      }
      while (start < lines.length && seen?.has(start)) start++;
      let end = start,
        size = 0;
      while (
        end < lines.length &&
        !seen?.has(end) &&
        size + lines[end]!.length + 1 <= Math.min(1600, remaining)
      )
        size += lines[end++]!.length + 1;
      if (end > start) add(file, start, end);
    }
  }
  return selected;
}

export function overviewCoverage(
  inventory: ProjectInventory,
  chunks: SourceChunk[],
) {
  const omitted = inventory.files.flatMap((file) => {
    const ranges = chunks.filter((c) => c.path === file.path);
    const gaps: string[] = [];
    let start: number | undefined;
    for (let line = 1; line <= file.lines + 1; line++) {
      const missing =
        line <= file.lines &&
        !ranges.some((c) => c.startLine <= line && c.endLine >= line);
      if (missing && start === undefined) start = line;
      if (!missing && start !== undefined) {
        gaps.push(`${start}-${line - 1}`);
        start = undefined;
      }
    }
    return gaps.length ? [`${file.path}:${gaps.join(",")}`] : [];
  });
  return `Initial specification setup: ${new Set(chunks.map((c) => c.path)).size} selected files from ${inventory.files.length} eligible files; ${chunks.reduce((n, c) => n + c.content.length, 0)} source characters (limit ${overviewBudget}). No exhaustive source audit was performed. Coverage is ${omitted.length ? "PARTIAL" : "all eligible text selected; semantic completeness unverified"}. Use --deep for complete eligible-source analysis.\n\nSelected evidence: ${chunks.map((c) => `${c.path}:${c.startLine}-${c.endLine}`).join(", ") || "None"}.\n\nOmitted line ranges (not analyzed):\n${omitted.map((s) => `- ${s}`).join("\n") || "None."}`;
}
