export const agentInstructionPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
  ".cursor/rules/sdd-clinic.mdc",
];

const start = "<!-- sdd-clinic:instructions -->";
const end = "<!-- /sdd-clinic:instructions -->";
const previousInstructions =
  "Use OpenSpec for behavioral changes: read relevant specs, draft a change, review its proposal/design/tasks, implement, verify scenarios, then archive. Project context and agent definitions live in .clinic/. Preserve uncommitted work.";

const priorInstructions = `## SDD Clinic development workflow

Before every development prompt, follow this workflow from the repository root:

1. Read repository instructions, .clinic/project.yaml, openspec/config.yaml and openspec/project/ guidance. Inspect relevant accepted specs under openspec/specs/ and active changes under openspec/changes/ before editing code.
2. Follow .clinic/skills/analyze-request/SKILL.md to compare the request with existing intent and implementation evidence. Reuse matching requirements and active changes; do not create duplicate specs or force edits when the current specs already cover the request.
3. If existing requirements need clarification, correction or changed behavior, follow .clinic/skills/refine-spec/SKILL.md first. For new features or missing intent, follow .clinic/skills/create-spec/SKILL.md to create a named OpenSpec change before implementation. A request may need both. Keep observable scenarios, research, proposal, design, validation plan and tasks consistent.
4. Review the proposal, design, scenarios and tasks, resolve blocking questions and validate with the project's pinned OpenSpec CLI. Obtain the required approval of the current revision before implementation. Specification changes invalidate earlier approval and QA.
5. Only then follow .clinic/skills/implement-spec/SKILL.md, implement the approved tasks and test the acceptance scenarios. Run configured checks, record actual evidence and limitations, and mark only verified tasks complete. Review and archive according to openspec/project/workflow.md; archive alone does not prove implementation or integration.

These canonical .clinic/skills/ files are authoritative. If your tool has no native skill loader, read and follow the files directly. If required guidance or skills are missing, repair them through Clinic's reviewed Set up SDD flow before implementation; do not silently skip the workflow. Preserve custom instructions and unrelated uncommitted work. Respect the assigned role: planning and read-only QA do not authorize implementation. Do not merge, push or deploy automatically.`;

const instructions = priorInstructions.replace(
  "These canonical",
  "At every stage, including after spec creation, during implementation and after verification, ask focused questions when product intent is unclear. Pause dependent work, preserve partial changes and record answers. Do not ask about routine technical choices or ordinary test failures. If an answer changes behavior, refine the specs and obtain approval of the new revision before continuing; invalidate earlier QA. Read UI/UX guidance and original sources under openspec/project/ when present.\n\nThese canonical",
);
const priorBlock = `${start}\n${priorInstructions}\n${end}`;
const block = `${start}\n${instructions}\n${end}`;
const previousBlock = `${start}\n${previousInstructions}\n${end}`;

export function agentInstructionContent(
  path: string,
  original: string | null,
): string {
  if (original === null) {
    const header = path.endsWith(".mdc")
      ? "---\ndescription: SDD Clinic development workflow\nalwaysApply: true\n---\n\n"
      : "";
    return `${header}${block}\n`;
  }
  const startCount = original.split(start).length - 1;
  const endCount = original.split(end).length - 1;
  if (startCount || endCount) {
    // Only migrate an exact stock block. Custom or damaged blocks belong to the owner.
    if (startCount === 1 && endCount === 1) {
      for (const newline of ["\n", "\r\n"]) {
        for (const stock of [previousBlock, priorBlock]) {
          const previous = stock.replaceAll("\n", newline);
          if (original.includes(previous))
            return original.replace(previous, () =>
              block.replaceAll("\n", newline),
            );
        }
      }
    }
    return original;
  }
  return `${original}${original.endsWith("\n") || !original ? "" : "\n"}\n${block}\n`;
}
