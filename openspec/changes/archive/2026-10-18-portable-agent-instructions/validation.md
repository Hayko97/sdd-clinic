# Validation plan

Planned checks are not observed outcomes. Record results and source/spec revisions in docs/verification.md.

| Exact scenario title | Check | Expected evidence |
| --- | --- | --- |
| Review portable instructions during setup | tests/agent-instructions.test.ts: both engine setup cases; tests/e2e/workspace.spec.ts: first project setup | All five native paths in the proposal, absent on disk until application, then present; Cursor default alwaysApply is true; browser displays the guidance diff |
| Route every development request through specifications | tests/agent-instructions.test.ts: inspect all generated guidance and referenced canonical skill files | Every file names the ordered analyze/refine/create/review/implement/verify decisions, reuse and missing-skill handling; canonical files exist; no claim of live compliance |
| Upgrade an existing Clinic instruction block | tests/agent-instructions.test.ts: LF and CRLF legacy blocks with prefix/suffix | Only the exact stock block changes, surrounding bytes survive, repeat setup is empty |
| Preserve custom instructions and repeat setup | tests/agent-instructions.test.ts: existing native files, custom/partial/duplicate blocks and Cursor metadata | Original custom text/metadata survives, a single block is appended when absent, custom marked blocks are unchanged, repeat setup is empty |
| Reject stale instruction updates | tests/agent-instructions.test.ts: external Copilot edit between proposal and apply | Apply fails; the edit survives and no other setup files appear |
| Refuse unsafe instruction targets | tests/agent-instructions.test.ts: symbolic linked instruction directory and unsupported setup paths | A visible rejection and no changes to the external directory or unsupported files |

Run pnpm check (types, all fixtures, strict specs, build) and pnpm test:e2e. Verify Clinic's own reviewed setup is idempotent, then rebuild/start with Docker Compose and check the served application. Live Codex/Claude/Gemini/Copilot/Cursor inference and external servers are not part of these checks.
