# agent-scheduling: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Portable project schedules identify their owning agent, task and cadence. The local scheduler records occurrences and outcomes, skips missed/offline intervals and avoids overlapping work. Developer schedules enter the same reviewed skill pipeline, rather than bypassing approval. Schedules execute only while the service is running and default to disabled.

## Implementation references
- [src/server/agent-schedules.ts](../../../src/server/agent-schedules.ts)
- [src/server/workflows.ts](../../../src/server/workflows.ts)

## Verification boundary
A scheduled occurrence or generated proposal is not implementation completion. External unattended model runs require an available authenticated provider.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
