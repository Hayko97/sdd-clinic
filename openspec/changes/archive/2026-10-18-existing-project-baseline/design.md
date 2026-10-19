# Design

## Boundaries and overlap
Extend spec-workspace and clinic-interface. Reuse portable agent generation and the current provider adapters, Runs lifecycle and proposal application. The setup baseline is a distinct reviewed import of inferred current behavior, not an implementation change. Existing capability files are never rewritten; requested changes to accepted behavior continue through refine-spec.

## Repository inventory
A dedicated inventory module walks recursively with no quick-inspection depth cutoff. Honor Git's ignored paths when the selected project is a Git root, and exclude known dependency/generated/credential directories, keys, local data, binaries and symlinks. Record paths and reasons for exclusions, hashes and line counts for all eligible text. Read complete files within explicit overall/file/entry limits; fail visibly on limits or unexpected read errors. Redact credential-like text before provider input. Fingerprint the source inventory so changed, added and removed evidence invalidate review.

## Analysis and synthesis
Use one durable setup-analysis run and project lock. Read-only provider calls operate from an empty scratch directory with no project tools, receiving only redacted evidence. Split long files and batches by size; require exact acknowledgement of every supplied chunk. Extract behavior/evidence notes, consolidate notes in bounded groups when needed, then synthesize capability definitions with structured purpose/requirements/scenarios and source line references. Validate citations against the supplied inventory and build native Markdown locally. Use installed analyze-request/create-spec skills when present, otherwise the bundled defaults while setup is still unapplied. Record selected skill revisions. Strictly validate generated native specs in a disposable directory before proposing.

## Reviewed baseline
Add a baseline proposal source restricted to new openspec/specs/<slug>/spec.md, the managed openspec/project/baseline-analysis.md report and the existing setup allowlist. Never overwrite accepted capability files. The report records coverage, exclusions, inferred status, evidence, reused capabilities, contradictions/questions and unverified tests. Preserve a custom report by rejecting an unsafe replacement. Attach the inventory fingerprint to the proposal and rescan before application. Standard file hashes continue to protect agent/config/spec targets. Source edits during analysis also reject the result. Regeneration may refresh the managed report but cannot duplicate or overwrite existing capabilities.

## API and UI
POST project/setup accepts mode auto (default), files or analyze. Auto starts analysis when the configured engine is connected; otherwise returns the ordinary reviewed files proposal plus an explicit analysis-unavailable message. Analyze requires that engine and never switches providers. Files installs only local scaffolding. Return a Run for asynchronous work or a Proposal for local files. Persist run proposalId and progress; expose project setup runs and proposals through existing project data. The UI follows run activity, allows cancellation and review after reload, and opens the final diff. No provider inference runs merely from browsing a project. Duplicate concurrent setup analysis is rejected.

## Failure handling and applicability
No repository writes occur during scanning or model work. Cancellation, restart, missing connection, malformed or incomplete output, invalid citations, unsafe paths and stale evidence retain an explicit failed/interrupted run. Limits stop completion instead of silently omitting files. Interface changes are the setup request mode and Run/Proposal metadata described above; no new storage schema or standalone contracts/data-model documents are needed. Browser acceptance and verification.md cover the walkthrough.

## Delivery
The user's request authorizes this implementation. Review and validate these artifacts first, then implement and verify with fixture providers. Run pnpm check and pnpm test:e2e and rebuild Docker Compose. Live model inference remains opt-in. This checkout has no initial commit: preserve uncommitted work and record local evidence without claiming isolated self-implementation or Git integration.
