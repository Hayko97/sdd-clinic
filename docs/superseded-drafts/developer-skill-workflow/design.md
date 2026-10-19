## Interpretation
The requested skills already exist as create-spec, refine-spec and implement-spec. Developer should use them to create, refine and implement specs; it should not generate another copy of these skills for every request. Refinement uses the dedicated refine-spec skill introduced by agent-cards-refinement. Missing defaults are installed through reviewed project setup.

## Overlap review
| Existing requirement or draft | Decision |
| --- | --- |
| agent-delivery / Configurable roles | Reuse role configuration; add operation routing rather than a new agent role. |
| agent-delivery / Isolated implementation, Independent QA, Evidence-bound review, Integration tracking | Reuse unchanged; the new handoff explicitly retains these gates. |
| project-skills / Project default skills | Reuse reviewed missing-only installation and customization preservation. |
| project-skills / Complete specification workflow and Evidence-aware implementation | Reuse skill behavior; add Developer routing and skill revision provenance, not duplicate skill definitions. |
| spec-workspace / Prompted change proposals, Conflict-safe editing, Revision approval | Reuse diff review, all-file stale-write checks and revision invalidation. |
| active project-agent-spec-workspace | Its UI/search and user-requested review feed the Developer author/refine operation. No duplicate delta to Spec-centered workspace; no-change output must use the same result contract. |
| active project-grid-home | Unrelated home navigation; no overlapping modified requirement. |

## Decisions
Make Run prompt the primary Developer action. It expresses the intent to review specs and implement the resulting approved behavior in one persisted workflow. Preserve create/refine/implement-only modes for narrower requests. Creation/refinement use the Developer role with proposal-only permissions; selecting Developer must not grant application-code write permissions in those modes. The existing implementation path remains isolated and approval-gated.

Load canonical .clinic/skills/create-spec/SKILL.md, refine-spec/SKILL.md or implement-spec/SKILL.md after project resolution. Capture name, path, content hash and the exact instructions supplied in run context so external skill edits cannot retroactively change attribution. Keep provider-specific protocol details in engine adapters.

Define a common authoring result that distinguishes no-change analysis from a nonempty file proposal. Share it with the pending project-agent-spec-workspace draft. A skill's instructions cannot bypass run permissions, stale-write checks or approval gates.

Default Developer instructions describe all three operations. Existing customized definitions are preserved; conflicting implementation-only instructions require a visible reviewed update. Do not silently reinterpret or overwrite them.

When implementation reveals new requirements, preserve its worktree and report the gap. Refinement produces a separate reviewable spec proposal. Applying it invalidates affected approval/QA under the existing revision rules. For a Run prompt workflow, approval of the revised snapshot permits continuation under the original implementation intent; interrupted work still requires explicit resume.

## Risks and verification
Model overlap analysis and skill adherence are not guaranteed by routing alone. Fixture tests verify routing, delivered content, provenance, permissions and response contracts. Scenario evidence and independent QA verify the implementation; optional live-provider runs are reported separately.

## Review status
Draft only. Specification authoring does not approve this change, modify the Developer configuration, implement the flow, or verify the new acceptance scenarios.


## Project ownership and schedules
Store portable agent and schedule definitions under the project .clinic directory, referencing project-local agent IDs and connection references. Store runtime next/last dispatch and occurrence records in SQLite. Credentials remain in the broker; shared executable installation does not imply shared project context or sessions. Capture the resolved configuration per run.

Persist stages: queued, reviewing-specs, drafting-change, awaiting-spec-approval, implementing, QA, review, completed/no-op, failed, interrupted, canceled. Map to existing change lifecycle without conflating an agent run with change acceptance or integration. Record every stage before publishing it. For an existing accepted spec without an active change, create a minimal implementation-tracking change referencing accepted requirements rather than duplicating them.

Use interval scheduling with UTC next-run storage and labeled local-time display. Serialize occurrence claiming, deduplicate by schedule ID and due time, and reuse change-level writer locks. Runs awaiting approval occupy the scheduled agent slot so repeated timers do not create duplicate proposals. On restart, skip missed occurrences and retain blocked/approval/interrupted state; do not dispatch a catch-up queue.

The product-analysis Optional schedules requirement already defines default-off and missed-run behavior. Reuse it for PO and extend the scheduler to all project agents; preserve metric review and credential restrictions. Migrate the existing project PO timer into a single PO-agent schedule transactionally. This draft does not schedule anything now.

## Approval boundary
The request authorizes a unified prompt workflow, not unattended acceptance of new requirements. Preserve the existing product rule that generated spec diffs are reviewed. A run with already approved unchanged requirements proceeds without an extra artificial approval. Newly changed requirements wait for spec approval, then continue without asking the user to submit the prompt again.
