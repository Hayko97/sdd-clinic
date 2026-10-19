# Design

## Research and overlap
See research.md. Existing spec-workspace owns setup, revision approval and file discovery; project-skills owns authoring; clinic-interface owns navigation. Extend these capabilities instead of adding a competing feature/spec format. The course's requirements map to OpenSpec deltas, its plan to design/tasks, and its validation document is added as a first-class artifact.

## Repository structure
Use openspec/project/{mission,tech-stack,roadmap,workflow}.md for shared context. These do not become capability specs or inflate counts. Install a portable `clinic-sdd` schema and original Markdown templates under openspec/schemas/. New projects select it; retain existing project configs. New Clinic-authored changes can select the installed Clinic schema for the standard spec-driven project; existing changes/custom schema selections retain their metadata. Clinic scaffolds proposal, research, design, validation, tasks, metadata and a capability delta in one reviewed proposal. Draft markers explicitly prevent approving empty scaffolding. Optional contracts/data-model documents are created only when the change needs them, with applicability recorded in design.

Accepted behavior stays in openspec/specs/<capability>/spec.md. Supporting capability design/validation notes are allowed, and active/archived change folders remain authoritative historical records. The UI groups all related documents by capability and lifecycle. Do not copy historical requirements into a second requirements.md. Project documents are editable through reviewed, conflict-safe proposals. Their revisions are included in change approval/context checks and copied into implementation workspaces.

## Readiness and compatibility
For the Clinic schema, require nonempty research, design, proposal, tasks, validation and at least one native delta; reject the explicit scaffold marker. Validation maps every scenario's exact title to a planned test/manual check. This checks planning coverage, not whether tests passed. Existing external spec-driven changes retain their existing approval rules. Runtime QA and immutable run evidence continue to determine verification; validation.md defines the plan and is not mutable test-result storage during implementation.

## Setup upgrade
Missing docs/templates are proposed without overwriting existing files. Unmodified previous default skill content can be upgraded in the same reviewed proposal; customized content is preserved. Provider wrappers continue to resolve canonical project skills. Setup remains idempotent. Project guidance records detected facts and unresolved intent rather than asserting an inferred mission is approved.

## Verification and delivery
Use unit/integration checks for preserved custom files, native schema status/instructions, complete scaffolds, rejected incomplete coverage, constitution approval invalidation and archived grouping. Browser checks cover setup, project guidance editing, all feature documents, historical navigation and 375px width. Run pnpm check and pnpm test:e2e; rebuild Docker and inspect served GUI. No initial Git commit exists, so no isolated self-implementation or integration is claimed. User authorization covers implementation and setup of Clinic itself; other projects receive reviewed setup proposals.
