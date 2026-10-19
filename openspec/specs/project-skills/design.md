# project-skills: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Canonical project skills live under .clinic/skills. Codex and Claude entrypoints refer to those same files. Setup upgrades only exact previous stock defaults and installs missing files; custom skill text survives. Developer records the selected skill revision and follows analysis, create/refine and implementation boundaries. Shared workflow guidance supplies artifact responsibilities without duplicating provider-specific protocols.

## Implementation references
- [src/server/skills.ts](../../../src/server/skills.ts)
- [src/server/projects.ts](../../../src/server/projects.ts)
- [src/server/runs.ts](../../../src/server/runs.ts)

## Verification boundary
Frontmatter validation and protocol fixtures do not prove the semantic quality of live model specifications.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
