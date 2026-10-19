---
name: implement-spec
description: Implement an approved OpenSpec change with scenario-linked tests, validation and evidence of the exact implemented revision.
---

# implement-spec

Read project instructions, .clinic/project.yaml, the approved proposal, design, delta specs and tasks. Check Clinic's change state and existing implementation/QA evidence before work. A checkbox, accepted spec or archived change alone does not prove implementation. If already verified at the current spec/code revisions, explain the evidence and avoid duplicate work. Otherwise identify missing or stale evidence.

Implement only approved behavior in the assigned isolated worktree. Preserve unrelated work and do not edit approved requirements. For every implementation pass, add or update meaningful tests for affected scenarios, run configured checks and strict OpenSpec validation, and record command, outcome and scenario evidence. If no test command exists or dependencies prevent execution, report unverified and describe what is missing; never claim a pass. Keep tasks accurate, marking only verified work complete. Requirement changes require a new review and invalidate QA.

Report changed files, spec revision, code revision, test results and remaining limitations. Clinic runs independent QA on the frozen code; failures return for revision. After passing current QA and review, synchronize/archive on the implementation branch. Done requires verified integration. Do not merge, push or deploy automatically.

## Project documentation workflow
Read openspec/project/mission.md, tech-stack.md and roadmap.md when present. Read openspec/project/workflow.md for the project's document contract, research and validation guidance. Use the project's schema templates and native OpenSpec artifact instructions; do not create duplicate requirements.md or plan.md copies.

Read research.md and validation.md when present. Implement each task group with its scenario-linked checks. Preserve the approved validation plan; record observed outcomes, exact revisions and limitations in run evidence. Review any discovered requirement gap before implementation continues. After verification, propose a roadmap update without implying integration occurred.

## Clarification throughout development
Before and after specification work, during implementation and after verification, check for unresolved product intent. Ask focused questions only when needed; pause dependent work and preserve partial code. Record answers with their stage and spec revision. Changed behavior requires a reviewed spec revision and invalidates earlier approval and QA. Routine technical choices and ordinary test failures do not require product questions. Read project UI/UX guidance and original source documents when relevant.
