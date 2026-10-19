# local-runtime: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
The Docker service publishes the browser port on host loopback. A private launch token establishes an HTTP-only browser session; restarting the process rotates the session, so use the current log URL. SQLite persists runtime state and run events before SSE delivery. Startup marks unfinished actions interrupted without replay. The persistent application volume retains registrations/history while repository files remain authoritative.

## Implementation references
- [src/server/cli.ts](../../../src/server/cli.ts)
- [src/server/app.ts](../../../src/server/app.ts)
- [src/server/store.ts](../../../src/server/store.ts)
- [compose.yaml](../../../compose.yaml)
- [Dockerfile](../../../Dockerfile)

## Verification boundary
Verify the actual Docker process and private launch link separately from fixture server tests. Retain the application volume across rebuilds.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
