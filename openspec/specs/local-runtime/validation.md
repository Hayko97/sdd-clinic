# local-runtime: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- A foreign web origin sends a mutation
- A browser reconnects
- The service stops during implementation
- A request combines resources from two projects
- Doctor runs without installed providers

## Check locations
[tests/api.test.ts](../../../tests/api.test.ts), [tests/delivery.test.ts](../../../tests/delivery.test.ts), [tests/auth.test.ts](../../../tests/auth.test.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Verify the actual Docker process and private launch link separately from fixture server tests. Retain the application volume across rebuilds.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
