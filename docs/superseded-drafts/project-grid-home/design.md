## Overlap review
- `clinic-interface / Complete management views`: already defines global project listing, setup and counts. Modify this requirement; do not create a separate project-registry capability.
- `clinic-interface / Accessible responsive layout`: reuse accessibility expectations; add observable grid-specific behavior.
- `project-skills / Project default skills`: reuse reviewed installation unchanged.
- Active companion `project-agent-spec-workspace` changes Spec-centered workspace and OpenSpec navigation, not this requirement. No overlapping delta.
## Decisions
Use existing registered projects and repository-backed summaries. Start on Projects independently of stored project selection. Keep project identity keyed by registration ID, not display name. Use responsive CSS grid and semantic buttons; unavailable repositories do not fail the whole list.
## Boundaries
List registered repositories only. Do not scan the host filesystem, auto-register projects, or authenticate providers. Existing card-grid code is observed implementation, not proof that every new scenario is verified.
## Review status
Draft for review. No implementation requested in this change-authoring pass.
