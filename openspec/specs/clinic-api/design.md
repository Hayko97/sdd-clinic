# clinic-api: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Fastify routes use validated request shapes, browser-session/origin checks and project-scoped resource lookups. Mutation endpoints are explicit; reads do not replay provider work. Manual change creation returns a reviewable draft proposal and does not immediately write its artifacts. Project-document edits use base hashes. Source credentials are parsed locally and retained behind the broker. Detailed request/response contracts live in docs/api.md.

## Implementation references
- [src/server/app.ts](../../../src/server/app.ts)
- [src/shared/types.ts](../../../src/shared/types.ts)
- [docs/api.md](../../../docs/api.md)

## Verification boundary
Exercise unauthenticated, stale-write and foreign-project failures as well as successful commands.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
