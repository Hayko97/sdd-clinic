import { z } from "zod";

export const reconstructionPath = "openspec/project/reconstruction.md";
export const reconstructionMarker = "<!-- sdd-clinic:reconstruction -->";
export const reconstructionAreas = [
  "purpose",
  "architecture",
  "workflows",
  "interfaces",
  "data",
  "presentation",
  "operations",
  "verification",
] as const;
const area = z
  .object({
    status: z.enum(["captured", "unknown", "not-applicable"]),
    details: z.string().min(50).max(30000),
    sources: z
      .array(
        z.object({
          path: z.string(),
          startLine: z.number().int().positive(),
          endLine: z.number().int().positive(),
        }),
      )
      .max(100),
    gaps: z.array(z.string().min(1).max(3000)).max(100),
  })
  .superRefine((value, context) => {
    if (value.status === "captured" && !value.sources.length)
      context.addIssue({
        code: "custom",
        message: "Captured areas need source evidence.",
      });
    if (value.status === "unknown" && !value.gaps.length)
      context.addIssue({
        code: "custom",
        message: "Unknown areas need explicit reconstruction blockers.",
      });
  });
export const reconstructionSchema = z.object({
  areas: z.object({
    purpose: area,
    architecture: area,
    workflows: area,
    interfaces: area,
    data: area,
    presentation: area,
    operations: area,
    verification: area,
  }),
});
export const reconstructionInstructions = `Produce a reconstruction blueprint usable by a developer with an EMPTY codebase and only these documents. Do not merely refer the developer to source files: describe the actual contracts and rules in self-contained prose. Return {"areas":{${reconstructionAreas.map((name) => `"${name}":{"status":"captured|unknown|not-applicable","details":"self-contained details or reason (at least 50 characters)","sources":[{"path":"...","startLine":1,"endLine":2}],"gaps":["missing information or unresolved decision"]}`).join(",")}}}. Every area is mandatory. Captured means supported by supplied evidence, NOT complete or verified. Unknown requires explicit gaps. Not-applicable requires a reason in details; do not use it to hide missing evidence.
Purpose: users, roles, outcomes, scope. Architecture: components, boundaries, dependencies and initialization order. Workflows: entry points, state transitions, permissions, success and failure behavior. Interfaces: routes/commands/events, inputs, outputs, status/error codes, validation and auth. Data: entities, fields/types/defaults, constraints, relations, migrations and persistence. Presentation: screen structure, navigation, interaction/responsive/accessibility rules and required assets; missing screenshots/binary assets must be explicit gaps. Operations: install/build/run/test commands actually supported by evidence, configuration names without secrets, services/versions and deployment assumptions. Verification: reproducible fixtures, acceptance comparisons against the existing app, failure cases and gaps in testability. Keep technical details here and observable requirements in native specs. Never invent credentials, commands, contracts or test results.`;

export function renderReconstruction(
  result: z.infer<typeof reconstructionSchema>,
  capabilities: string[],
  excluded: { path: string; reason: string }[],
  questions: string[],
) {
  return `${reconstructionMarker}
# Reconstruction blueprint

Status: UNVERIFIED. This source-derived blueprint requires owner review. No application code was changed or executed. Captured areas are not proof of complete coverage or exact equivalence. Source references are provenance; the descriptions must stand on their own for implementation from an empty codebase.

## Behavior specifications
${capabilities.map((path) => `- ${path}`).join("\n") || "No new capabilities; review existing accepted specifications."}

${reconstructionAreas
  .map((name) => {
    const section = result.areas[name];
    return `## ${name}\n\nEvidence status: ${section.status}\n\n${section.details}\n\nSources: ${section.sources.map((s) => `\`${s.path}:${s.startLine}-${s.endLine}\``).join(", ") || "None available."}\n\n### Gaps and decisions\n${section.gaps.map((gap) => `- ${gap}`).join("\n") || "No specific gap reported; semantic completeness still requires review."}`;
  })
  .join("\n\n")}

## Unresolved questions
${questions.map((question) => `- ${question}`).join("\n") || "No additional questions reported; review every area before implementation."}

## Excluded evidence
${excluded.map((item) => `- ${item.path}: ${item.reason}`).join("\n") || "No excluded paths recorded."}
Excluded/generated/dependency files were not analyzed. Required external services, binary assets and unavailable runtime observations must be supplied or explicitly replaced before equivalent behavior can be established.

## Clean-room implementation and comparison
1. Review every area and resolve unknowns with the owner. Record any intentional deviation from existing behavior.
2. Copy the approved OpenSpec documents and explicitly required non-code assets into a separate empty repository. Do not copy application implementation code.
3. Implement in dependency order using the contracts and native acceptance scenarios. Refine incomplete specifications before guessing behavior.
4. Capture reference observations from the existing application using approved, non-destructive fixtures. Record revision, environment, inputs, outputs, side effects and relevant screenshots.
5. Run the same fixtures against the new implementation and compare observable results, including failure paths and data constraints. Record differences, actual evidence and unresolved gaps in each capability's validation plan.
6. Claim equivalence only for the scenarios actually compared. All checks remain UNVERIFIED until executed; setup itself does not perform reconstruction or comparison.
`;
}
