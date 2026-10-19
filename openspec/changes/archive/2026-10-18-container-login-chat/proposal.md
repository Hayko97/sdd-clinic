## Why
Clinic detects Codex in Docker but cannot sign it in. Its host-terminal guidance sends users to a different credential environment. The Developer form and separate workflow cards also lack a coherent conversational interaction.
## What Changes
- Add provider-owned Codex device-code sign-in inside Clinic's runtime, with visible waiting, completion, cancellation and failure states.
- Show runtime-specific manual guidance and only report Connected after authentication is confirmed.
- Replace the project Developer form with a Claude Code-inspired chat: chronological turns, live activity, inline review and approvals, keyboard controls and a persistent bottom composer.
- Preserve project-scoped drafts, history, and summarized context for subsequent completed-workflow prompts.
## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `engine-connections`: supported device-code sign-in and accurate runtime diagnostics.
- `clinic-interface`: conversational Developer workspace.
- `developer-workflow`: project-scoped follow-up context.
## Impact
Engine adapter, local authentication lifecycle, REST endpoints, Developer workspace, fixture tests and browser tests. Credentials remain provider-managed; no host authentication files are imported. Docker remains the application runtime.
