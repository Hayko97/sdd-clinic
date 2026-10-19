## Implementation and verification
- [x] Local connection prompt parser and authenticated import/update route; URL, env, SSH, malformed/ambiguous input and deduplication tests.
- [x] Encrypted credential persistence with restart, tamper, deletion and session-only fallback evidence.
- [x] Agent-scoped broker/MCP context and access, including assigned Developer and foreign-agent/project denial using real SQLite.
- [x] Chat credential input and inline sources; remove data setup form/page and preserve feature metrics contextually. Browser tests for secret-free drafts/history, disconnected save, reload, update/delete and 375px layout.
- [x] Run pnpm check and pnpm test:e2e, rebuild Docker, inspect the served UI, and record exact source/spec evidence. External live calls remain separately unverified.

Scenario evidence: `tests/connection-input.test.ts` covers import, credential storage and agent access; `tests/e2e/workspace.spec.ts` covers chat input, project switching, inline source controls and responsive layout. See `docs/verification.md` for revision digests and Docker checks. Archive synchronizes the verified requirements; no Git integration is claimed.
