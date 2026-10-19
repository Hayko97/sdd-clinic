# SDD Clinic specifications

The repository is authoritative. Each Clinic capability has accepted `spec.md`, a current `design.md` reference and a `validation.md` coverage reference. The workspace groups these together with every related active and archived change. Historical artifacts remain in their native OpenSpec folders rather than being copied into competing requirement files.

Project-level guidance is under [openspec/project](../openspec/project/): mission, technology, roadmap and workflow. New feature bundles include research, proposal, native requirement deltas, design, validation and tasks. Read [SDD practices and course research](sdd-practices.md) for sources, the full directory structure and explicit transcript-access limitations. A file or template alone is not implementation evidence.

| Capability | Scope | Specification |
| --- | --- | --- |
| Project interface | Project grid; conversational Developer workspace with keyboard controls and drafts; inline agents, skills and grouped documents; accessible layout | [clinic-interface](../openspec/specs/clinic-interface/spec.md) |
| Specifications | Onboarding, OpenSpec artifacts, revisions, proposals, validation and conflict-safe editing | [spec-workspace](../openspec/specs/spec-workspace/spec.md) |
| Project skills | Default skills, duplicate intent review, creation/refinement and implementation evidence | [project-skills](../openspec/specs/project-skills/spec.md) |
| Developer workflow | Prompt analysis, skill routing, clarification, scoped follow-up context, reviewed continuation and interruption | [developer-workflow](../openspec/specs/developer-workflow/spec.md) |
| Agent delivery | Agent configuration, isolated implementation, independent QA, revision-bound review and integration | [agent-delivery](../openspec/specs/agent-delivery/spec.md) |
| Agent schedules | Project-owned saved tasks, disabled defaults, offline/overlap skips and outcomes | [agent-scheduling](../openspec/specs/agent-scheduling/spec.md) |
| API | Project-scoped workflow/schedule commands, validation and ownership | [clinic-api](../openspec/specs/clinic-api/spec.md) |
| CLI connections | Codex and Claude discovery, runtime-specific authentication, Codex device sign-in, adapter events and sessions | [engine-connections](../openspec/specs/engine-connections/spec.md) |
| Product analysis | Database/server evidence, metrics, backlog findings and optional PO analysis | [product-analysis](../openspec/specs/product-analysis/spec.md) |
| Runtime | Local browser sessions, durable events, recovery and project isolation | [local-runtime](../openspec/specs/local-runtime/spec.md) |

API details belong in [the API reference](api.md); technical choices and overlap decisions belong in each change's design document. Accepted requirements and archived task checklists are product intent and historical evidence, not proof that any arbitrary checkout has been implemented or integrated.

The `project-workspace-flow` change replaces three earlier pending drafts; their original artifacts remain under [superseded-drafts](superseded-drafts/) as historical proposals. They are not recorded as separately implemented changes.
