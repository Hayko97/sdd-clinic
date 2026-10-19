# Build SDD Clinic

## Why
Developers need a local workspace to set up SDD in any repository, inspect and edit specs through prompts, and coordinate implementation, QA, and product analysis using their installed coding CLIs.

## What Changes
- Add CLI-first onboarding and a persistent multi-project browser workspace.
- Add OpenSpec setup, proposal review, revision tracking, and direct or prompted editing.
- Add configurable Developer, QA, and PO agents with isolated runs and durable evidence.
- Add read-only database/server connections, an internal backlog, and optional PO scheduling.
- Define Clinic's own behavior in OpenSpec before implementation and verify it against these scenarios.

## Capabilities
### New Capabilities
- `engine-connections`: CLI discovery, protocol adapters, authentication diagnostics, and approval handling.
- `spec-workspace`: repository setup, OpenSpec browsing, reviewed edits, and conflict handling.
- `agent-delivery`: configurable agents, isolated implementation, independent QA, and integration tracking.
- `product-analysis`: read-only connections, evidence, metric mapping, findings, and scheduling.
- `local-runtime`: local session security, persistence, replay, interruption, and project separation.
- `clinic-interface`: accessible project navigation and a document-and-conversation workspace.
### Modified Capabilities
None.

## Impact
New local application and npm CLI. Repositories receive reviewed OpenSpec and Clinic configuration only. Runtime state stays outside repositories; credentials stay in the OS credential store or memory. No hosted accounts, deployment automation, or external tracker writes in v1.
