---
name: refine-spec
description: Review and refine an existing OpenSpec specification or active change for clarity, completeness and duplicate intent. Use for revisions, not new capabilities from scratch or code implementation.
---

# refine-spec

Identify the selected project, existing specification and requested improvement. Read openspec/config.yaml, .clinic/project.yaml, repository instructions, related accepted requirements and active changes. If the target is unclear, ask for it before drafting. Compare intent and scenarios, not just titles. Record overlap decisions and preserve unrelated requirements.

Review observable behavior, ambiguous terms, missing failure scenarios, contradictions and testability. Distinguish clarification from changed product behavior. Explain when existing wording already satisfies the request; do not invent changes merely to produce a diff. Never infer that existing code is approved intent.

For an accepted spec, propose an OpenSpec delta in a named change; never overwrite accepted behavior directly. For an active change, update that change instead of creating a competing duplicate. Preserve full requirements when using MODIFIED Requirements. Update proposal, design and scenario-linked tasks consistently. New capabilities need a meaningful Purpose. Keep technical choices in design and mark unresolved assumptions for review.

Use the pinned OpenSpec CLI to validate the revised artifacts and present the diff with reasons for material changes. In Clinic obey its proposal JSON contract and let the application apply reviewed edits. If an external edit invalidates the base, reread and regenerate rather than overwrite. Requirement changes invalidate prior approvals and QA; keep implementation tasks unchecked until verified. Stop after the refinement report/proposal. Do not implement code, mark the change Done, archive it or merge it as part of refinement.

## Project documentation workflow
Read openspec/project/mission.md, tech-stack.md and roadmap.md when present. Read openspec/project/workflow.md for the project's document contract, research and validation guidance. Use the project's schema templates and native OpenSpec artifact instructions; do not create duplicate requirements.md or plan.md copies.

Create or maintain research.md (source references, dates, alternatives and overlap decisions), validation.md (every exact scenario title, a specific check/manual procedure and expected evidence), and the native proposal/spec/design/tasks artifacts. Record whether contracts.md, data-model.md or a walkthrough is needed; add them only when applicable. Resolve scaffold markers and blocking unknowns before review. Keep planned validation separate from observed results. Order small task groups by dependency and include their tests in each group. On refinement update impacted artifacts together and revalidate.

## Clarification throughout development
Before and after specification work, during implementation and after verification, check for unresolved product intent. Ask focused questions only when needed; pause dependent work and preserve partial code. Record answers with their stage and spec revision. Changed behavior requires a reviewed spec revision and invalidates earlier approval and QA. Routine technical choices and ordinary test failures do not require product questions. Read project UI/UX guidance and original source documents when relevant.
