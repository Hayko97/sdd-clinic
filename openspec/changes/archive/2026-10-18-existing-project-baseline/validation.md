# Validation plan

Record outcomes separately in docs/verification.md; these are planned checks.

| Exact scenario title | Check | Expected evidence |
| --- | --- | --- |
| Analyze nested source and documentation | tests/setup-analysis.test.ts: nested files, long-file batches, both providers | Every eligible chunk acknowledged; specs include native headings and exact source references; full tail content reaches provider |
| Disclose excluded and unavailable content | inventory fixture tests for ignored/generated/secret/binary/symlink files and limits | Reported exclusion reasons; no secret content/provider access; actionable failure instead of truncation |
| Review inferred behavior with portable instructions | setup API integration plus browser setup | No writes before Apply; native specs/report and all five instruction paths in diff; uncertainty remains visible; strict validation passes |
| Preserve an existing specification baseline | existing-spec/custom-guidance and repeated-setup fixtures | Existing spec bytes and custom instructions survive; reuse reported; duplicate/overwrite attempts rejected |
| Sources change before baseline application | edit/add/delete source and stale-target fixtures | Entire proposal rejected; source edit survives and no setup files written |
| Provider output or analysis is incomplete | missing chunk, invalid citation/output, cancellation/restart/failure and concurrency cases | Failed/interrupted status, useful error, no complete proposal, explicit retry |
| No inferable capability exists | empty/all-existing provider output | Coverage report explains absence of new specs without fake placeholders |
| Follow and review setup analysis | tests/e2e/workspace.spec.ts: setup progress, reload, review, Apply, grouped specs, 375px | Durable run/review actions, source report and generated capabilities visible |
| Set up files without a provider | API and browser fixtures for disconnected and files modes | Agent/skill installation still works; clear analysis-not-run message; no model calls |

Run pnpm check and pnpm test:e2e. Rebuild Docker and check the actual served setup controls. Real provider semantic quality, external servers and target-branch integration are unverified unless separately authorized and exercised.
