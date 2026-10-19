# product-analysis: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Project chat locally parses connection details and separates public metadata from encrypted credentials. Explicit agent assignments gate narrow broker/MCP tools. PostgreSQL/MySQL/MongoDB/SQLite analysis is bounded and read-only; SSH inspection uses verified host fingerprints and permitted SFTP paths. PO findings reference timestamped evidence, distinguish anomalies from proven bugs, deduplicate recurring observations and can become proposed changes.

## Implementation references
- [src/server/data.ts](../../../src/server/data.ts)
- [src/server/vault.ts](../../../src/server/vault.ts)
- [src/server/connection-input.ts](../../../src/server/connection-input.ts)
- [src/server/mcp.ts](../../../src/server/mcp.ts)
- [src/server/runs.ts](../../../src/server/runs.ts)

## Verification boundary
Mocked driver contracts, real disposable SQLite/SSH tests and external live services are separate evidence. Saving credentials does not prove connectivity.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.
