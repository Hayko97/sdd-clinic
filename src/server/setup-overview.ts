import type { ProjectInventory, SourceChunk } from "./project-inventory.js";
import { assert } from "./util.js";

// Existing current/pending intent is mandatory; other evidence is a bounded sample.
export function setupOverview(inventory: ProjectInventory): SourceChunk[] {
  const mandatory = inventory.files.filter(
    (f) =>
      /^openspec\/specs\/.*\.md$/.test(f.path) ||
      /^openspec\/changes\/(?!archive\/).+\.md$/.test(f.path),
  );
  const selected: SourceChunk[] = [];
  let remaining = 36_000;
  const add = (path: string, content: string) => {
    selected.push({
      id: String(selected.length + 1),
      path,
      content,
      startLine: 1,
      endLine: content.split("\n").length,
    });
    remaining -= content.length;
  };
  for (const file of mandatory) {
    assert(
      file.content.length <= remaining,
      "Existing specification intent exceeds the initial setup context limit. Run sddclinic setup --deep to preserve and reconcile all existing specifications.",
    );
    add(file.path, file.content);
  }
  const score = (path: string) => {
    if (/^(?:readme|product|requirements)\.(?:md|txt)$/i.test(path)) return 0;
    if (
      /^openspec\/project\/(?:mission|roadmap|tech-stack|ui-ux)\.md$/.test(path)
    )
      return 1;
    if (
      /^(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|pom\.xml|Gemfile|composer\.json)$/.test(
        path,
      )
    )
      return 2;
    if (/(?:^|\/)(?:app|main|index|routes?|server)\.[^.]+$/i.test(path))
      return 3;
    if (/\.(?:tsx?|jsx?|py|rs|go|java|php|rb|vue|svelte|sql)$/i.test(path))
      return 4;
    if (/^(?:docs|documentation)\//.test(path)) return 5;
    return 6;
  };
  const ordinary = inventory.files.filter(
    (f) =>
      !mandatory.includes(f) &&
      !/^(?:\.clinic\/|\.agents\/|\.claude\/|\.cursor\/|\.github\/|openspec\/changes\/archive\/)/.test(
        f.path,
      ) &&
      !/^(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(f.path),
  );
  ordinary.sort(
    (a, b) =>
      score(a.path) - score(b.path) ||
      a.path.split("/").length - b.path.split("/").length ||
      a.path.localeCompare(b.path),
  );
  for (const file of ordinary.slice(0, 24)) {
    if (remaining <= 0) break;
    const limit = Math.min(6000, remaining);
    let content = file.content.slice(0, limit);
    // Prefer complete lines; retain a fragment only for a single very long line.
    if (content.length < file.content.length && content.lastIndexOf("\n") > 0)
      content = content.slice(0, content.lastIndexOf("\n") + 1);
    add(file.path, content);
  }
  return selected;
}
