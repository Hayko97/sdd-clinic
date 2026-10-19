# Portable agent instructions

## Why
Project setup currently writes a short OpenSpec reminder for Codex and Claude. It omits the decision to refine existing specifications or create new ones before each development request, and other coding tools receive no native instruction file.

## What Changes
- Propose persistent project instructions for Codex, Claude, Gemini CLI, GitHub Copilot and Cursor, with AGENTS.md as the shared convention for other compatible agents.
- Direct every development request through intent analysis, necessary refinement or new specification creation, review, implementation and scenario verification using canonical project skills.
- Upgrade the exact previous Clinic instruction block, preserve custom content and retain reviewed, conflict-safe, idempotent setup.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `spec-workspace`: portable instruction files in reviewed project setup.

## Impact
Setup generation and path validation, instruction discovery, setup acceptance tests, project guidance and Clinic's own instruction files. Execution engines remain Codex and Claude; instruction portability does not add runtime adapters.
