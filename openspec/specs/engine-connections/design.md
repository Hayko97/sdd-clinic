# engine-connections: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Engine adapters normalize Codex app-server and Claude programmatic streaming events. Authentication belongs to the runtime containing the executable, which is Docker in the standard setup. The Codex device flow exposes an ephemeral challenge and checks connection state after completion. Provider sessions are resumed only within their own engine; interruption and approval requests retain explicit state.

## Implementation references
- [src/server/engines.ts](../../../src/server/engines.ts)
- [src/server/engine-auth.ts](../../../src/server/engine-auth.ts)

## Verification boundary
Live tests are opt-in. A fixture sign-in success or actual device challenge does not prove completed user authorization or model inference.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
