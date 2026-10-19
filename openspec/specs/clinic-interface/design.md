# clinic-interface: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Project-card home and one project workspace keep the Developer conversation, agent cards, schedules, project guidance and specification groups in the same project context. Documents are classified as current, proposed or archived; historical bundles link back to each affected capability. Render project controls only after the selected project response arrives to prevent cross-project actions. Long paths and document groups wrap at narrow widths.

Project setup defaults to source/document analysis when the configured CLI is connected. Users can choose guidance files only; disconnected setup explicitly says that inferred specs were not generated. The existing run inspector displays analysis progress and cancellation. Persisted run/proposal links let the workspace reopen review after reload. Baseline diffs identify inferred status and point to coverage/exclusion/contradiction notes before Apply.

## Implementation references
- [src/web/main.tsx](../../../src/web/main.tsx)
- [src/web/ProjectWorkspace.tsx](../../../src/web/ProjectWorkspace.tsx)
- [src/web/DeveloperChat.tsx](../../../src/web/DeveloperChat.tsx)
- [src/web/style.css](../../../src/web/style.css)

## Verification boundary
Visually inspect desktop and 375px layouts; keyboard, composition and long-content behavior need browser evidence.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
