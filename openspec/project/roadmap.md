# SDD Clinic roadmap

## Current baseline
The repository contains local implementations and fixture evidence for the following slices. Historical verification below predates the first public source release and is not retroactive evidence of target-branch integration. Historical plans live under ../changes/archive/; exact verification records live in ../../docs/verification.md.

| Slice | Capability references | Evidence reference |
| --- | --- | --- |
| Local service and provider adapters | local-runtime, engine-connections | API, engine and device-auth tests; Docker launch checks |
| Project setup and spec workspace | spec-workspace, project-skills, clinic-interface | Setup/edit tests and browser workflows |
| Developer delivery and QA | developer-workflow, agent-delivery | TypeScript/Python fixture delivery and workflow tests |
| Project schedules | agent-scheduling | Offline, overlap and occurrence tests |
| Product evidence | product-analysis, clinic-api | Real SQLite/disposable SSH, broker and backlog tests |

## Locally verified improvement: complete SDD documentation
Archived change: ../changes/archive/2026-10-18-sdd-documentation-kit/. Add project guidance, native feature templates, validation coverage, safe default-skill upgrades and current/archived capability document navigation. Verification is recorded in ../../docs/verification.md; target-branch integration is not claimed.

Locally verified portable agent guidance is recorded in ../changes/archive/2026-10-18-portable-agent-instructions/ and ../../docs/verification.md. Setup now carries the specification-first workflow into Codex, Claude, Gemini CLI, GitHub Copilot, Cursor and other AGENTS.md-compatible tools. This is file-generation and workflow-fixture evidence, not live-agent compliance or Git integration.

Locally verified existing-project baseline setup is recorded in ../changes/archive/2026-10-18-existing-project-baseline/ and ../../docs/verification.md. Connected setup now analyzes eligible source/documentation in batches, proposes inferred capability specs with coverage/evidence, and installs portable agent guidance through the same review. Live semantic completeness and Git integration remain unverified.

Locally verified prompt/document setup and durable development clarification are recorded in ../changes/archive/2026-10-18-prompt-project-clarification/ and ../../docs/verification.md. New project drafts retain original sources and ask essential questions before reviewed application; Developer questions preserve stage, revisions and partial work. Live model interpretation and Git integration remain unverified.

## Follow-up requiring real environment evidence
- Complete the chosen provider's supported authentication and opt-in live model smoke check.
- Use the published source baseline for isolated implementation runs; track subsequent integration evidence per change.
- Configure and explicitly test actual external database/server access only when the project needs it.
- Prioritize the next user-requested feature using current specs and evidence; do not silently schedule these follow-ups.

## Definition of completion
Link the accepted spec/context revision, implementation commit, current scenario evidence, independent QA, reviewed archive and verified target-branch integration. Replan after each feature when evidence changes requirements or constraints.
