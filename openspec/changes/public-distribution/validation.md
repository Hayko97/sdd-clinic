# Validation

| Scenario | Check | Expected evidence |
| --- | --- | --- |
| Install CLI and GUI from a release | Install actual release tarball in isolated prefix; inspect bundled web assets; launcher fixture and Docker GUI smoke | Global executable works and matching image starts GUI |
| Runtime image is unavailable | Simulated failed pull | Actionable failure and no silent build/image substitution |
| Build from source | Source build tests and explicit override fixture | Correct version built from runtime assets |
| Verify distribution before publication | pnpm check then pnpm test:e2e; artifact inventory and secret/private-data review | Passing checks and publishable allowlisted contents |
| Publication requires account access | Observe actual account state and registry responses | Accurate published/pending state; no secrets in output |

Live provider inference is not part of distribution checks. Registry publication is explicitly authorized; personal account sign-in remains owner-operated.

Obtain separately licensed provider tooling: wrapper fixture uses a fake vendor installer to verify first installation, cached repeat use, argument forwarding and failure propagation. Public image must contain the launcher rather than Claude binaries.
