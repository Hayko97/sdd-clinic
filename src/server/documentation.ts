import { parse, stringify } from "yaml";
import { readdir } from "node:fs/promises";
import type { Project } from "../shared/types.js";
import { readOptional, safeName, safePath } from "./util.js";

export const clinicSchema = "clinic-sdd";
export const draftMarker = "[CLINIC:DRAFT]";
export const projectDocumentNames = [
  "mission",
  "tech-stack",
  "roadmap",
  "workflow",
];
export const artifactTemplates: Record<string, string> = {
  "research.md": `# Research\n\n${draftMarker} Resolve before approval.\n\n## Existing intent and evidence\nRecord related capabilities, requirements, active changes and repository references. Explain reuse, modification or new intent.\n\n## Decisions and sources\nFor uncertainties, record the question, primary source or code evidence, observation date, decision, alternatives and confidence. If no external research is needed, explain why. Never invent transcript access or source evidence.\n\n## Assumptions and open questions\nSeparate observed behavior from approved intent. Resolve questions that affect scope; label deferrable assumptions.\n`,
  "proposal.md": `# Feature proposal\n\n${draftMarker} Resolve before approval.\n\n## Why\nExplain the user problem and desired outcome.\n\n## What Changes\nDescribe scope, non-goals and compatibility impact.\n\n## Capabilities\n### New Capabilities\nList new capability paths, or None.\n### Modified Capabilities\nUse exact existing paths and requirement names, or None.\n\n## Impact\nIdentify affected users, components, data and interfaces.\n`,
  "spec.md": `## Purpose\n${draftMarker} Define the durable user outcome for a new capability; omit this section for an existing capability.\n\n## ADDED Requirements\n\n### Requirement: Intended behavior\nThe system SHALL replace this draft with one observable behavior.\n\n#### Scenario: Observable outcome\n- **WHEN** a concrete input or action occurs\n- **THEN** a measurable result occurs.\n\nInclude relevant error, boundary, access and recovery scenarios. Use full MODIFIED requirements for existing intent; do not duplicate it.\n`,
  "design.md": `# Design\n\n${draftMarker} Resolve before approval.\n\n## Context and decisions\nLink project guidance and research. Describe the approach, alternatives, constraints and rationale without restating requirements.\n\n## Interfaces and data\nRecord inputs, outputs, errors and compatibility when boundaries change. Add contracts.md or data-model.md only if needed; otherwise state why they are not applicable.\n\n## Risks and rollout\nDescribe affected state, migration/rollback needs and unresolved implementation risks. Keep scope proportional.\n`,
  "validation.md": `# Validation plan\n\n${draftMarker} Resolve before approval.\n\n## Scenario coverage\nMap every exact scenario title to a test or manual procedure and expected evidence. Planned checks are not results.\n\n| Scenario | Check / procedure | Expected evidence |\n| --- | --- | --- |\n| Observable outcome | Specify a runnable check | Specify its observable assertion |\n\n## Environments and limits\nName required dependencies, fixtures, manual checks and opt-in external checks. Missing prerequisites mean unverified.\n\n## Acceptance and evidence\nImplementation must pass the current scenario checks and independent QA at the approved spec and code revisions. Keep run outcomes in Clinic run evidence or a separate verification report; do not rewrite the approved plan to claim a pass. Archive does not prove integration.\n`,
  "tasks.md": `# Tasks\n\n${draftMarker} Resolve before approval.\n\n## 1. First vertical slice\n- [ ] 1.1 Replace with a small implementation task and its scenario-linked test or manual check.\n\n## 2. Integration validation\n- [ ] 2.1 Run configured checks, verify the validation plan, and report failed or unverified criteria with evidence.\n\n## Workflow follow-up\n- Review, synchronize/archive and verify integration through the project's existing Git workflow.\n`,
};

const artifacts = [
  { id: "research", generates: "research.md", requires: [] },
  { id: "proposal", generates: "proposal.md", requires: ["research"] },
  { id: "specs", generates: "specs/**/*.md", requires: ["proposal"] },
  { id: "design", generates: "design.md", requires: ["research", "specs"] },
  {
    id: "validation",
    generates: "validation.md",
    requires: ["specs", "design"],
  },
  { id: "tasks", generates: "tasks.md", requires: ["validation", "design"] },
];
export const schemaFiles = [
  {
    path: `openspec/schemas/${clinicSchema}/schema.yaml`,
    after: stringify({
      name: clinicSchema,
      version: 1,
      description:
        "Project guidance → research → proposal → requirements/design → validation → tasks",
      artifacts: artifacts.map((a) => ({
        ...a,
        description: `Reviewable ${a.id} for the feature`,
        template: a.id === "specs" ? "spec.md" : a.generates,
        instruction: `Read openspec/project/ and related accepted specs/active changes. Follow the template, replace ${draftMarker} with concrete project evidence and keep only relevant detail. ${a.id === "specs" ? "Use native OpenSpec ADDED/MODIFIED/REMOVED Requirements and WHEN/THEN scenarios; include meaningful Purpose for new capabilities. Preserve full modified requirements." : "Do not invent completed checks or approvals."}`,
      })),
      apply: {
        requires: ["tasks"],
        tracks: "tasks.md",
        instruction:
          "Read project guidance and the complete feature bundle. Implement scenario-linked tasks with tests. Report evidence separately from the approved validation plan. Review changed intent before continuing.",
      },
    }),
  },
  ...Object.entries(artifactTemplates).map(([name, after]) => ({
    path: `openspec/schemas/${clinicSchema}/templates/${name}`,
    after,
  })),
];

export const workflowGuide = `# Project SDD workflow

## Shared project context
Read mission.md, tech-stack.md and roadmap.md here, .clinic/project.yaml, repository instructions, accepted specs and relevant active changes. Preserve existing intent. Confirm unresolved scope with the owner; document low-impact assumptions without inventing product decisions.

## Feature folder
Use openspec/changes/<change>/ with research.md (sources and overlap decisions), proposal.md (why/scope), specs/<capability>/spec.md (requirements and scenarios), design.md (how and tradeoffs), validation.md (scenario-to-check plan), tasks.md (small verifiable slices), and .openspec.yaml. Native OpenSpec names avoid duplicate requirements.md/plan.md copies. Add contracts.md, data-model.md or a walkthrough only when their content helps this change; record applicability in design.

## Plan, implement, verify, replan
1. Analyze intent and search accepted/active requirements for overlap.
2. Research uncertain claims using repository evidence or primary sources, recording dates and uncertainty. No research needed is a valid conclusion when explained.
3. Create or refine the complete feature bundle. Every scenario needs a specific test/manual check and expected evidence in validation.md. Resolve blocking questions, review the diff, run strict validation and approve the revision.
4. Implement small task groups with their tests in an isolated workspace. Read the constitution and approved validation plan. Record outcomes at exact spec/code revisions; preserve the approved plan.
5. Independently verify scenarios, include UI/manual checks when relevant, and distinguish passed, failed and unverified. A checked task is not test evidence.
6. If implementation reveals a requirement gap, refine and reapprove; invalidate stale QA. Review the roadmap after each feature. Archive reviewed changes and verify integration before calling them Done.

## Existing applications
Inventory documentation, code, tests and telemetry first. Label inferred behavior for review, preserve custom instructions/schema/skills and split baseline capabilities by cohesive user behavior. Do not accept all existing bugs as intended requirements.

## Portable skills and evidence
Use analyze-request → create-spec/refine-spec → implement-spec with Codex or Claude. Tools and model-specific wrappers are separate from project intent. Test plans live with changes, run outcomes live in Clinic, historical artifacts remain in the archive. Never put credentials in specifications.

## Research basis
Adapted, with original templates, from [DeepLearning.AI course materials](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files), [OpenSpec workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md) and [Spec Kit interface contracts](https://github.com/github/spec-kit/blob/main/docs/guides/contract-driven-development.md). These are references, not commands to run or authority to merge/deploy. No single file count is a universal SDD requirement.
`;

export function projectDocuments(
  name: string,
  inspection: {
    languages: string[];
    entries: string[];
    testFiles: string[];
    commands: { name: string; command: string; args: string[] }[];
    docs: { path: string; content: string }[];
  },
) {
  const documents: Record<string, string> = {
    mission: `# ${name}: mission\n\n## Product intent — owner review needed\nDefine the target users, their problem, desired outcomes and non-goals. Repository name and code are evidence, not approved product intent.\n\n## Existing context\nReview ${inspection.docs.map((d) => d.path).join(", ") || "the repository documentation and stakeholder request"} before defining baseline requirements.\n`,
    "tech-stack": `# ${name}: technology and constraints\n\n## Detected facts — confirm before use\nLanguages: ${inspection.languages.join(", ") || "not detected"}.\nRepository entries: ${inspection.entries.join(", ")}.\n\n## Candidate checks\n${inspection.commands.map((c) => `- ${c.name}: ${c.command} ${c.args.join(" ")}`).join("\n") || "No commands detected. Define a reliable test command before implementation."}\n\n## Test evidence references\n${inspection.testFiles.map((p) => `- ${p}`).join("\n") || "No tests detected; do not infer validation coverage."}\n\n## Architecture decisions\nRecord chosen boundaries, constraints and tradeoffs after reviewing the project. These detected commands have not been executed by setup.\n`,
    roadmap: `# ${name}: roadmap\n\n## Establish the baseline\nReview the mission, observed architecture and existing requirements. Record inferred behavior separately from approved intent.\n\n## Next feature — owner review needed\nChoose the next small user outcome, link existing capabilities, dependencies and its OpenSpec change. Do not mark a feature complete from generated files or checked boxes alone.\n\n## Completion evidence\nLink approved spec revision, code revision, current QA and verified target-branch integration. Replan when evidence reveals gaps.\n`,
    workflow: workflowGuide,
  };
  return Object.entries(documents).map(([name, after]) => ({
    path: `openspec/project/${name}.md`,
    after,
  }));
}

export async function changeSchema(project: Project, name?: string) {
  if (name) {
    const existing = await readOptional(
      await safePath(
        project.path,
        `openspec/changes/${safeName(name)}/.openspec.yaml`,
      ),
    );
    if (existing) return String(parse(existing)?.schema || "spec-driven");
  }
  const config = await readOptional(
    await safePath(project.path, "openspec/config.yaml"),
  );
  const selected = config
    ? String(parse(config)?.schema || "spec-driven")
    : "spec-driven";
  // Imported legacy changes may inherit their schema without metadata.
  if (
    name &&
    (await readOptional(
      await safePath(
        project.path,
        `openspec/changes/${safeName(name)}/proposal.md`,
      ),
    ))
  )
    return selected;
  if (selected !== "spec-driven") return selected;
  return (await readOptional(
    await safePath(
      project.path,
      `openspec/schemas/${clinicSchema}/schema.yaml`,
    ),
  ))
    ? clinicSchema
    : selected;
}

export async function authoringInstructions(project: Project, name: string) {
  const schema = await changeSchema(project, name);
  return `Read openspec/project/ guidance and the selected schema's artifact instructions. Keep existing change metadata; for a new change use schema: ${schema}. Include research.md with overlap decisions and source evidence; proposal.md; native specs/<capability>/spec.md; design.md with interface/data-model applicability; validation.md with every exact scenario title mapped to a concrete check and expected evidence; tasks.md with small scenario-linked groups. Replace ${draftMarker} with substantive content. Do not label planned checks as passed or invent research. Keep requirements/design/validation consistent when refining.`;
}

export async function schemaSupportFiles(project: Project) {
  const files: { path: string; content: string }[] = [];
  const config = await readOptional(
    await safePath(project.path, "openspec/config.yaml"),
  );
  if (config !== null)
    files.push({ path: "openspec/config.yaml", content: config });
  const walk = async (path: string, depth: number) => {
    if (depth > 5 || files.length > 100)
      throw new Error(
        "OpenSpec schema files exceed the supported project context limit.",
      );
    let entries;
    try {
      entries = await readdir(await safePath(project.path, path), {
        withFileTypes: true,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.isFile() && /\.(md|ya?ml)$/.test(entry.name)) {
        const content = await readOptional(await safePath(project.path, child));
        if (content !== null) files.push({ path: child, content });
      }
    }
  };
  await walk("openspec/schemas", 0);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
