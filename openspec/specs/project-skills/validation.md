# project-skills: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- Customized project is set up again
- Project selection changes
- Refine an existing specification
- Requested behavior already exists
- Implementation has no passing current evidence
- Container restarts
- Author a feature
- Update unchanged default skills
- Verify an implementation

## Check locations
[tests/skills.test.ts](../../../tests/skills.test.ts), [tests/specs.test.ts](../../../tests/specs.test.ts), [tests/documentation.test.ts](../../../tests/documentation.test.ts), [tests/workflows.test.ts](../../../tests/workflows.test.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Frontmatter validation and protocol fixtures do not prove the semantic quality of live model specifications.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
