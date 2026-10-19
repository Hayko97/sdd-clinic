# product-analysis: validation reference

## Evidence status
This is a coverage map, not a passing result. Use [dated verification records](../../../docs/verification.md) and current Clinic runs to establish outcomes at exact revisions. Missing or unavailable checks are unverified.

## Acceptance scenarios
- An agent attempts a write, multiple SQL statements, or a write aggregation stage
- A requested path escapes permitted roots or a host key differs
- Docker restarts without an OS keyring
- Persistent secret storage is unavailable
- Encrypted credentials are damaged
- Data shows an anomaly without proven incorrect behavior
- A scheduled analysis rediscovers an existing finding
- The service starts after scheduled times were missed
- Paste and save a database connection
- Update an existing connection
- Unsupported or ambiguous input
- Assigned Developer inspects data
- Another agent or project requests access
- SSH access settings are incomplete

## Check locations
[tests/data.test.ts](../../../tests/data.test.ts), [tests/connectors.test.ts](../../../tests/connectors.test.ts), [tests/ssh.test.ts](../../../tests/ssh.test.ts), [tests/connection-input.test.ts](../../../tests/connection-input.test.ts), [tests/api.test.ts](../../../tests/api.test.ts)

Run the relevant suites for the scenarios changed, then `pnpm check` and `pnpm test:e2e` before delivery. Each new feature adds a scenario/check/expected-evidence table in its own validation.md. Review test assertions against the exact scenario rather than treating a suite pass as proof of every criterion.

## Environment and manual checks
Mocked driver contracts, real disposable SQLite/SSH tests and external live services are separate evidence. Saving credentials does not prove connectivity.

## Completion
Require current spec/context and code revisions, independent QA and reviewed integration evidence. Archived checklists alone are insufficient.
