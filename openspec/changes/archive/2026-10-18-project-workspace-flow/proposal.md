## Why
The current sidebar separates agents, specs and runs across screens. Users need a simple project grid and a single workspace where their team, schedules, specification documents and Developer prompt are together.
## What Changes
- Remove the persistent sidebar and dedicated Agents page from navigation. Open each project into one workspace with inline agent cards, schedules, grouped specs and a Developer composer.
- Group main capabilities and their change artifacts; allow opening every associated Markdown document without manual URL navigation.
- Add analyze-request skill and a persisted Developer pipeline: analyze intent, create/refine as needed, review/approve, implement, tests and QA.
- Add project-agent schedules with saved prompts and explicit failure/overlap behavior.
- Define behavioral API contracts separately from UI and delivery.
## Capabilities
### New Capabilities
- `developer-workflow`: persisted prompt-to-development orchestration.
- `agent-scheduling`: project-owned optional schedules and execution history.
- `clinic-api`: project-scoped endpoint contracts for workflow and schedule commands.
### Modified Capabilities
- `clinic-interface`: two-level project navigation and inline project workspace.
- `project-skills`: request-analysis skill and sequence.
## Impact
Browser composition, orchestration, repository-backed schedule definitions, runtime state and API tests. Supersedes three pending drafts preserved under docs/superseded-drafts. Existing approval, isolated worktree, QA and credential boundaries remain.
