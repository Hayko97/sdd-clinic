# Design

## Architecture
React/Vite renders a three-column spec workspace and dedicated project, agent,
backlog, run, and connection views. Fastify owns REST, SSE, process management,
OpenSpec operations, Git workspaces, and connection brokers. Node 24 SQLite
persists versioned JSON records and an append-only run event journal.

## Boundaries
EngineAdapter normalizes Codex app-server JSON-RPC and Claude CLI JSONL. Browser
requests never invoke a shell string. MCP supplies scoped Clinic tools and the
Claude permission callback. Spec edits are generated as JSON file proposals by
read-only agent turns; the service validates paths and base hashes before apply.
Database and SSH secrets are never included in agent context. PO receives bounded
broker outputs with timestamps and redaction. Developer and QA have no broker
connection tools. SHA-256 hashes bind acceptance to immutable spec snapshots.

## Lifecycle
Draft -> Ready -> Developing -> QA -> Review -> Ready to integrate -> Done.
One writer per change. Development starts from a committed Git baseline plus
approved spec artifacts in a dedicated worktree. QA checks the resulting commit
in another worktree. Finalization archives OpenSpec on the implementation branch;
integration is verified using Git ancestry. No automatic merge or push.

## Persistence and recovery
OpenSpec and .clinic files are authoritative; SQLite holds local run state,
conversations, proposed edits, backlog, connection references, and schedules.
Events are saved before delivery and replayed by sequence number. On restart,
incomplete runs become interrupted; no action is retried automatically.

## Security and portability
Loopback only, per-launch browser bootstrap token exchanged for an HttpOnly
SameSite session, host/origin checks, bounded bodies, and safe relative paths.
Read-only database credentials remain required. SQL uses a conservative SELECT
subset plus read-only transactions; Mongo allows only a bounded aggregation
subset. SSH uses SFTP reads and forwarded database sockets, with pinned host keys.
macOS/Linux are supported; Windows development can use WSL. Keyring failure falls
back to session-only secrets. Live-provider/remote-DB verification is opt-in.

## Validation
Vitest exercises repository conflicts, protocol fixtures, SQL guards, worktree
isolation, lifecycle transitions, durable events, and API boundaries. Playwright
exercises CLI onboarding and the spec edit/review workflow. Disposable TypeScript
and Python repositories exercise development and QA with scripted providers.
