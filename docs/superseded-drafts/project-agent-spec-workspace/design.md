## Interpretation
Treat the request as project navigation to Agents plus searching specs and requesting rewrites when needed. Agent review is explicit, never a background rewrite on project opening. This interpretation is exposed for review.
## Overlap review
- `clinic-interface / Spec-centered workspace`: modify with project navigation and explicit review scenarios.
- `spec-workspace / OpenSpec navigation`: modify with precise search scope, result identity and empty behavior.
- `spec-workspace / Prompted change proposals`, Conflict-safe editing and Revision approval: reuse unchanged for reviewed diffs, stale-write rejection and invalidation.
- `agent-delivery / Configurable roles`: reuse Developer/QA/PO/custom configuration; no duplicate agent capability.
- `project-skills / Complete specification workflow`: reuse overlap checks in create-spec.
- Companion `project-grid-home` modifies a different requirement; both changes can be reviewed independently.
## Decisions
Use existing project IDs and conversation context paths. Clear search and selected-document state on project changes. Include accepted requirements and pending deltas in review context. A no-change assessment needs an explicit report without forcing proposal creation; audit the existing JSON response handler before implementing that path. Preserve entered prompts on provider errors.
## Risks and limitations
Semantic review depends on provider output. Deterministic tests must cover no-change versus rewrite protocol results, not claim model reasoning correctness. Live provider review is opt-in and separately reported. Existing code may already satisfy parts of this draft; only implementation verification establishes completion.
## Review status
Draft for review. No code changes or automatic execution authorized by this specification-authoring pass.
