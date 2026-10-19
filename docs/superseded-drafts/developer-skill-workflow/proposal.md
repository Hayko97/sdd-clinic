## Why
Each project needs its own agents, CLI choices and optional schedules. Developer should accept a prompt and carry one workflow through spec review, necessary creation/refinement, implementation and QA instead of requiring the user to manually chain separate operations.
## What Changes
- Add a primary Run prompt flow to the project's Developer agent, retaining optional create/refine/implement-only actions.
- Review current specs and active changes for every prompt; use create-spec for new intent and refine-spec for an existing target only when needed, then use implement-spec for approved behavior.
- Bind agent definitions, schedules, prompts, skills and execution evidence to the selected project.
- Resolve the project Codex/Claude connection with an optional agent override; never silently switch engines.
- Allow optional per-agent schedules with saved prompts, visible next/last executions and skipped/blocked results.
- Preserve reviewed spec changes, isolated implementation, tests, independent QA and revision evidence.
## Capabilities
### New Capabilities
### Modified Capabilities
- `agent-delivery`: project-owned agent configuration, prompt-to-implementation orchestration and per-agent schedules.
- `project-skills`: authoritative project skill resolution and run-level provenance.
## Impact
Developer configuration and actions, CLI references, orchestration and scheduling. Existing custom definitions remain intact. Existing PO schedules migrate to the project's PO agent without duplicate timers. This draft defines product schedules; it does not create an automation in the Codex app.

## Superseded
Replaced by project-workspace-flow after the user requested one project workspace with no sidebar. Preserved for reference; not implemented or archived as accepted.
