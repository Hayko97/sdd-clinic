# agent-delivery: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- An agent definition changes on disk
- The source checkout contains unrelated uncommitted work
- A required test cannot run
- The implementation changes after QA
- The user requests QA after a manual implementation commit
- The user reviews an implementation
- The change is finalized but not merged

## Check locations
[tests/delivery.test.ts](../../../tests/delivery.test.ts), [tests/workflows.test.ts](../../../tests/workflows.test.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Clinic itself currently lacks an initial commit. Disposable committed TypeScript/Python fixtures verify isolation and integration behavior.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
