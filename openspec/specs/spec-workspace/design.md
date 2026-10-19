# spec-workspace: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
SpecRepository discovers repository Markdown, records content hashes and stages reviewed edits before replacing files. Project guidance participates in approved context revisions. Native OpenSpec templates and delta operations remain authoritative; Clinic adds scaffold and validation-coverage checks for clinic-sdd changes. Approval is separate from file existence and test results. Custom schemas and existing documents are retained.

Reviewed setup generates native agent guidance from one shared workflow for Codex, Claude, Gemini CLI, GitHub Copilot and Cursor. It upgrades only the exact previous stock block, preserves custom content and metadata, and includes instruction paths in bounded inspection and the exact setup allowlist. All tools resolve canonical project skills under .clinic/skills/; portable files do not add execution engines. Customized or damaged managed blocks require manual review.

Existing-project setup can recursively inventory eligible text and use bounded read-only provider batches to infer a capability baseline. Chunk acknowledgements and source-line references are checked; large findings are consolidated before synthesis. Generated native specs are strictly validated in a disposable directory. The reviewed baseline proposal combines new capabilities, a managed coverage/uncertainty report and portable setup files. Existing specs cannot be overwritten, and repository fingerprints reject changed, added or removed source evidence before Apply. Local files-only setup remains available without a provider. Coverage accounting is not proof of model semantic completeness.

## Implementation references
- [src/server/specs.ts](../../../src/server/specs.ts)
- [src/server/projects.ts](../../../src/server/projects.ts)
- [src/server/agent-instructions.ts](../../../src/server/agent-instructions.ts)
- [src/server/documentation.ts](../../../src/server/documentation.ts)
- [src/server/project-inventory.ts](../../../src/server/project-inventory.ts)
- [src/server/setup-analysis.ts](../../../src/server/setup-analysis.ts)

## Verification boundary
Native schema status only confirms artifact presence. Verify the validation plan and scenario evidence separately.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.

## Prompt and product source setup
Setup drafts stage prompts, extracted document text and original attachments in persistent application storage. Generation uses complete source batches and native adapter image inputs, then produces a reviewed text/binary proposal. New destinations are created only during Apply; existing specs and custom guidance remain authoritative. Source errors, size limits, missing provider access and stale destinations are explicit failures, never partial success.
