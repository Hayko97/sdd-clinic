# agent-delivery: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Developer starts from an explicitly selected committed baseline in a dedicated branch/worktree, augmented with approved specs, project guidance and schema files. QA evaluates a frozen implementation in a separate workspace. The review checks exact code and context revisions and rejects stale evidence. Finalization archives on the implementation branch; Done requires ancestry verification on the configured target branch.

## Implementation references
- [src/server/runs.ts](../../../src/server/runs.ts)
- [src/server/specs.ts](../../../src/server/specs.ts)

## Verification boundary
Clinic itself currently lacks an initial commit. Disposable committed TypeScript/Python fixtures verify isolation and integration behavior.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
