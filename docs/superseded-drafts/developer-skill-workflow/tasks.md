## 1. Review and contracts
- [ ] 1.1 Review the primary prompt workflow, optional scoped operations and project schedules and missing-skill behavior; compare current code with the scenarios and record verified coverage and gaps.
- [ ] 1.2 Align authoring/no-change result contracts with project-agent-spec-workspace without duplicating its UI requirements.
## 2. Implementation and scenario coverage
- [ ] 2.1 Add operation controls and routing; fixture/browser-test Create a specification, Refine an existing specification and Operation intent is ambiguous.
- [ ] 2.2 Load and capture canonical project skills; test Customized project skill, Skill changes during a run and Project selection changes using two independent repositories.
- [ ] 2.3 Validate missing/invalid/unreadable skills; test reviewed default installation and preservation of invalid/customized files without fallback execution.
- [ ] 2.4 Support no-change authoring output without empty proposals; test Existing requirements already satisfy the request and reuse existing stale-write rejection coverage.
- [ ] 2.5 Extend default Developer instructions and reviewable adoption; test customized-project instruction preservation and proposal-only creation/refinement permissions.
- [ ] 2.6 Test Implement the approved specification and stale/draft rejection, with exact spec/code revision attribution and independent QA.
- [ ] 2.7 Test Implementation reveals a requirement change: preserve partial work, refine through refine-spec, invalidate stale approval/QA and continue the approved workflow using its recorded implementation intent.
- [ ] 2.8 Test unavailable tests/validation and already-verified implementation paths; do not equate completed tasks with verified behavior.
## 3. Delivery verification
- [ ] 3.1 Run pnpm check and pnpm test:e2e after implementation; record each scenario's result and evidence. Report live-provider checks separately.
- [ ] 3.2 Verify the Developer flow in the Docker GUI, review the final diff, and synchronize/archive only after acceptance. Verify integration separately.

## 4. Project prompts and schedules
- [ ] 4.1 Test two projects with different CLI/agent configurations, override resolution, unavailable provider handling and prompt preservation.
- [ ] 4.2 Browser/fixture-test Run prompt through spec review, new/refined requirements, approval and implementation without re-entering the prompt.
- [ ] 4.3 Test existing approved requirements, missing implementation evidence, tracking-change creation and already-verified no-op outcomes.
- [ ] 4.4 Test persisted stage transitions, approval waiting, cancellation, explicit resume and no duplicate completed mutations after restart.
- [ ] 4.5 Add project-agent schedule configuration UI and portable storage; test enable/disable/edit, next/last display and captured prompt revisions.
- [ ] 4.6 Use a controlled clock to test due occurrences, missed intervals, active-run/approval overlap, atomic deduplication and single implementation-writer enforcement.
- [ ] 4.7 Test PO schedule migration preserves cadence, enabled state and reviewed-metric restrictions without duplicate timers.
