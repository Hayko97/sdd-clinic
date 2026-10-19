# clinic-api: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- Start and inspect
- Cross-project continuation
- Malformed schedule

## Check locations
[tests/api.test.ts](../../../tests/api.test.ts), [tests/documentation.test.ts](../../../tests/documentation.test.ts), [tests/connection-input.test.ts](../../../tests/connection-input.test.ts), [tests/mcp.test.ts](../../../tests/mcp.test.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Exercise unauthenticated, stale-write and foreign-project failures as well as successful commands.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
