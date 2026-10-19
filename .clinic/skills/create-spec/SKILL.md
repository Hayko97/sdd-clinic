---
name: create-spec
description: Create or revise OpenSpec changes after reviewing existing requirements and active changes for duplicate intent.
---

# create-spec

Read openspec/config.yaml, .clinic/project.yaml, repository instructions, accepted specs and active changes before drafting. Search by feature intent, terminology and scenario, not only filenames. Compare related requirements and report overlaps in design.md: existing capability, matching requirement, and reuse/modify/new decision. If intent already exists, explain the match; do not create a duplicate capability. Conflicting pending changes need an explicit resolution before approval.

Use the project's pinned OpenSpec CLI. Inspect status and artifact instructions when available. Create a named change with proposal.md (why, scope, new/modified capabilities, impact), design.md (decisions, overlap review, risks), specs/<capability>/spec.md (ADDED/MODIFIED/REMOVED deltas), tasks.md and .openspec.yaml. New capabilities need a meaningful Purpose. Describe observable SHALL requirements with WHEN/THEN scenarios, including failures. Keep technical choices in design. Label inferred behavior for review.

Map every scenario to an intended test or explicit manual check in tasks.md. Run strict OpenSpec validation, resolve errors, then present the diff for review. Do not overwrite accepted specs or start implementation during spec creation. In Clinic return the requested proposal JSON; the application applies reviewed edits. Flow: discover → overlap review → proposal/design/scenarios/tasks → validate → review/approve → implement → tests and independent QA → review → sync/archive → verify integration. Archive is not evidence of implementation.

## Project documentation workflow
Read openspec/project/mission.md, tech-stack.md and roadmap.md when present. Read openspec/project/workflow.md for the project's document contract, research and validation guidance. Use the project's schema templates and native OpenSpec artifact instructions; do not create duplicate requirements.md or plan.md copies.

Create or maintain research.md (source references, dates, alternatives and overlap decisions), validation.md (every exact scenario title, a specific check/manual procedure and expected evidence), and the native proposal/spec/design/tasks artifacts. Record whether contracts.md, data-model.md or a walkthrough is needed; add them only when applicable. Resolve scaffold markers and blocking unknowns before review. Keep planned validation separate from observed results. Order small task groups by dependency and include their tests in each group. On refinement update impacted artifacts together and revalidate.

## Clarification throughout development
Before and after specification work, during implementation and after verification, check for unresolved product intent. Ask focused questions only when needed; pause dependent work and preserve partial code. Record answers with their stage and spec revision. Changed behavior requires a reviewed spec revision and invalidates earlier approval and QA. Routine technical choices and ordinary test failures do not require product questions. Read project UI/UX guidance and original source documents when relevant.
