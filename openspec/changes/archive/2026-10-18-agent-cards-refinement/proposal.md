## Why
Agent cards currently expose long instructions instead of a concise overview. Projects also need a dedicated reusable skill for refining existing specifications.
## What Changes
Improve the agent grid with search, role summaries, explicit engine/model and trigger information, expandable instructions and labeled actions. Install refine-spec alongside create-spec and implement-spec, preserve custom skills, and use refine-spec for existing-spec conversations. Align the pending Developer workflow with the new skill. Shorten the accepted management-views requirement without changing its behavior to resolve its existing strict-validation warning.
## Capabilities
### New Capabilities
### Modified Capabilities
- `clinic-interface`: scannable responsive agent cards and nonbehavioral requirement wording cleanup.
- `project-skills`: default refine-spec skill and existing-spec routing.
## Impact
Agent UI/CSS, skill templates and setup inventory, conversation routing and tests. No scheduling or prompt-to-implementation functionality from pending drafts is implicitly implemented.
