# engine-connections: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- A missing executable is selected
- Login instructions are shown inside Docker
- A user continues a conversation
- A provider requests an unapproved action
- Credentials are absent or the provider denies access
- Codex is installed but Docker is unsigned
- Sign-in fails, expires or is canceled
- Duplicate sign-in or changed executable
- Service restarts during sign-in

## Check locations
[tests/engines.test.ts](../../../tests/engines.test.ts), [tests/auth.test.ts](../../../tests/auth.test.ts), [tests/live.test.ts](../../../tests/live.test.ts), [tests/e2e/workspace.spec.ts](../../../tests/e2e/workspace.spec.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Live tests are opt-in. A fixture sign-in success or actual device challenge does not prove completed user authorization or model inference.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
