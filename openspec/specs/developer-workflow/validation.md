# developer-workflow: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- Prompt needs changed behavior
- Prompt matches an approved change
- Analysis needs clarification
- Required skill or CLI is unavailable
- Review and continue
- Restart or cancellation
- Tests are unavailable
- Continue a completed conversation
- Context belongs to another project or agent

## Check locations
[tests/workflows.test.ts](../../../tests/workflows.test.ts), [tests/e2e/workspace.spec.ts](../../../tests/e2e/workspace.spec.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Live model analysis remains distinct from recorded protocol fixture behavior; incomplete proposals must be refined before continuation.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.

## Product source setup and clarification
Scenario coverage for prompt-project-clarification is verified in tests/clarification.test.ts and the Developer browser workflow. Real document extraction and provider protocol fixtures are distinct from live semantic interpretation. Exact observations live in docs/verification.md.
