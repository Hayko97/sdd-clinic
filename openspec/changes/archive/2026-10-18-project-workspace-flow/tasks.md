## Implementation
- [x] 1. Replace sidebar navigation with project home and unified workspace; group Markdown by capability/change.
- [x] 2. Add analyze-request skill and persisted Developer analyze → spec → review → implement pipeline.
- [x] 3. Add project-owned schedules, endpoint validation and overlap/restart behavior.
- [x] 4. Document API contracts and organize capabilities without duplicate pending drafts.
## Verification
- [x] 5. Fixture-test orchestration, skills, approval continuation, project isolation and schedule outcomes.
- [x] 6. Browser-test unified workspace, document grouping, inline agents and prompt workflow.
- [x] 7. Run pnpm check, pnpm test:e2e, skill validation and Docker visual verification; report live checks separately.

## Scenario evidence map

| Scenarios | Verification |
| --- | --- |
| Open project, no sidebar, inline agent search/actions, schedules, grouped docs and 375px viewport | tests/e2e/workspace.spec.ts: project grid workspace |
| Browse/setup without CLI and second-project separation | tests/e2e/workspace.spec.ts: second project; tests/api.test.ts |
| Every Markdown file remains reachable and related changes share capability groups | tests/workspace.test.ts; document prompt/edit browser flow |
| Analyze/refine/review/implement/QA and persisted browser refresh | tests/workflows.test.ts; Developer prompt browser workflow |
| New behavior uses create-spec and selected agent engine | tests/workflows.test.ts: complete proposal and CLI override |
| Approved unchanged change goes directly to implementation | tests/workflows.test.ts: approved change |
| Clarification, missing skills, cancellation, stale proposal/revision and duplicate starts | tests/workflows.test.ts |
| Interrupted continuation has no automatic replay | tests/workflows.test.ts: restart reconciliation; tests/api.test.ts: run recovery |
| Unavailable checks and failed QA remain distinct | tests/delivery.test.ts: failed/unverified fixtures |
| Invalid schedule/agent, disabled defaults, missed intervals, overlap and provider failure | tests/workflows.test.ts; schedule browser workflow |
| Cross-project continuation and existing authentication/origin enforcement | tests/workflows.test.ts; tests/api.test.ts |
| Customized setup and four default skills | tests/specs.test.ts; Skill Creator validation |

Live model inference and external infrastructure remain opt-in, outside fixture verification. This checkout has no committed Git baseline; local changes are not claimed as an integrated Clinic implementation branch.
