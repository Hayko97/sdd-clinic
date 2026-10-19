import { expect, it } from "vitest";
import { groupSpecFiles } from "../src/web/ProjectWorkspace.js";
import type { SpecFile } from "../src/shared/types.js";
it("groups current capabilities with every linked change document and retains unassigned changes", () => {
  const paths = [
    "openspec/specs/ui/spec.md",
    "openspec/specs/api/spec.md",
    "openspec/changes/feature/proposal.md",
    "openspec/changes/feature/design.md",
    "openspec/changes/feature/tasks.md",
    "openspec/changes/feature/specs/ui/spec.md",
    "openspec/changes/feature/specs/api/spec.md",
    "openspec/changes/new-capability/specs/scheduling/spec.md",
    "openspec/changes/early-draft/proposal.md",
  ];
  const files: SpecFile[] = paths.map((path) => ({
    path,
    name: path.split("/").at(-1)!,
    content: path,
    hash: path,
    kind: path.startsWith("openspec/specs/") ? "spec" : "change",
    change: path.startsWith("openspec/changes/")
      ? path.split("/")[2]
      : undefined,
  }));
  const groups = groupSpecFiles(files);
  expect(
    new Set(groups.flatMap((g) => g.documents.map((d) => d.path))),
  ).toEqual(new Set(paths));
  expect(
    groups.find((g) => g.name === "ui")!.documents.map((d) => d.path),
  ).toContain("openspec/changes/feature/tasks.md");
  expect(
    groups.find((g) => g.name === "api")!.documents.map((d) => d.path),
  ).not.toContain("openspec/specs/ui/spec.md");
  expect(groups.find((g) => g.name === "scheduling")).toBeTruthy();
  expect(groups.find((g) => g.name === "Change: early-draft")).toBeTruthy();
  expect(groupSpecFiles([])).toEqual([]);
});

it("keeps capability notes and archived feature bundles together without mixing unrelated histories", () => {
  const paths = [
    "openspec/project/mission.md",
    "openspec/specs/accounts/login/spec.md",
    "openspec/specs/accounts/login/design.md",
    "openspec/specs/accounts/login/validation.md",
    "openspec/changes/archive/2026-10-01-login/specs/accounts/login/spec.md",
    "openspec/changes/archive/2026-10-01-login/proposal.md",
    "openspec/changes/archive/2026-10-01-login/research.md",
    "openspec/changes/archive/2026-10-01-login/design.md",
    "openspec/changes/archive/2026-10-01-login/validation.md",
    "openspec/changes/archive/2026-10-01-unrelated/design.md",
  ];
  const files: SpecFile[] = paths.map((path) => ({
    path,
    name: path,
    content: path,
    hash: path,
    kind: path.includes("/archive/")
      ? "archive"
      : path.includes("/project/")
        ? "project"
        : "spec",
  }));
  const groups = groupSpecFiles(files);
  expect(groups).toHaveLength(1);
  expect(groups[0]!.name).toBe("accounts/login");
  expect(groups[0]!.documents.map((f) => f.path)).toEqual(paths.slice(1, -1));
});
