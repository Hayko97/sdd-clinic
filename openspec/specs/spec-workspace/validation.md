# spec-workspace: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- Setup is applied a second time
- The repository contains existing schema and test files
- A file changes outside Clinic
- A user accepts a generated proposal
- One file has changed since an edit was proposed
- An approved artifact changes
- A new capability has no meaningful purpose
- Initialize project guidance
- Adopt an existing project
- Project guidance changes after approval
- Create a new change
- Incomplete validation plan
- Existing external workflow
- Edit shared project guidance
- Review portable instructions during setup
- Route every development request through specifications
- Upgrade an existing Clinic instruction block
- Preserve custom instructions and repeat setup
- Reject stale instruction updates
- Refuse unsafe instruction targets
- Analyze nested source and documentation
- Disclose excluded and unavailable content
- Review inferred behavior with portable instructions
- Preserve an existing specification baseline
- Sources change before baseline application
- Provider output or analysis is incomplete
- No inferable capability exists

## Check locations
[tests/specs.test.ts](../../../tests/specs.test.ts), [tests/documentation.test.ts](../../../tests/documentation.test.ts), [tests/e2e/workspace.spec.ts](../../../tests/e2e/workspace.spec.ts)

[tests/agent-instructions.test.ts](../../../tests/agent-instructions.test.ts) covers portable setup, guidance routing, legacy upgrades, custom content and metadata preservation, idempotence, stale edits and unsafe targets. External tools' compliance with instruction files is not verified by these fixture checks.

[tests/setup-analysis.test.ts](../../../tests/setup-analysis.test.ts) covers complete nested/batched text delivery, source evidence, exclusions and limits, consolidation, preserved current specs and instructions, strict generated specs, stale-source rejection, failures/cancellation/restart, empty baselines and provider-free setup. Live semantic completeness remains unverified.

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Native schema status only confirms artifact presence. Verify the validation plan and scenario evidence separately.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.

## Product source setup and clarification
Scenario coverage for prompt-project-clarification is verified in tests/setup-drafts.test.ts and the product-source browser workflow. Real document extraction and provider protocol fixtures are distinct from live semantic interpretation. Exact observations live in docs/verification.md.
