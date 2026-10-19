# agent-scheduling: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- Configure a schedule
- Invalid agent or QA target
- Restart after missed intervals
- Agent already has work

## Check locations
[tests/workflows.test.ts](../../../tests/workflows.test.ts), [tests/api.test.ts](../../../tests/api.test.ts), [tests/e2e/workspace.spec.ts](../../../tests/e2e/workspace.spec.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
A scheduled occurrence or generated proposal is not implementation completion. External unattended model runs require an available authenticated provider.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
