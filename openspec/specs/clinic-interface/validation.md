# clinic-interface: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- A user selects a spec and submits a prompt
- Inspect a capability and its documents
- The workspace has no projects
- Existing project has no connected engine
- Global home after opening Clinic
- Project setup without provider sign-in
- Open a project
- An operation fails
- The viewport narrows
- Find and inspect an agent
- No agents match
- View cards on a narrow screen
- Engine or trigger is inherited
- Send a prompt and follow its work
- Compose using keyboard controls
- Draft and project context survive navigation
- Provider is disconnected
- Narrow viewport and long messages
- Watch implementation while files change
- Paste credentials into the composer
- Return to a project
- No provider is connected
- Narrow screen
- Switch projects during background refresh
- Inspect an established capability
- Browse project guidance
- Supporting files and project separation
- Narrow document navigation
- Follow and review setup analysis
- Set up files without a provider

## Check locations
[tests/workspace.test.ts](../../../tests/workspace.test.ts), [tests/e2e/workspace.spec.ts](../../../tests/e2e/workspace.spec.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Visually inspect desktop and 375px layouts; keyboard, composition and long-content behavior need browser evidence.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
