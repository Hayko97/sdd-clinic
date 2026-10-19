# SDD Clinic technology and architecture

## Chosen stack
TypeScript; React/Vite browser UI; Node.js 24/Fastify local API; SQLite runtime state; pnpm; pinned OpenSpec 1.14.2. Run the application with Docker Compose, published only on host loopback. Tests and build checks may run locally.

## Boundaries
- Repository: openspec/ requirements, changes, project guidance and schema templates; .clinic/ project configuration and canonical skills.
- Local application volume: project registrations, conversations, runs, events and evidence. The repository is the source of truth for documents.
- Provider adapters: Codex app-server and Claude structured streaming. Protocol details stay behind adapters.
- Credential broker: OS keyring or encrypted persistent vault; session-only fallback is labeled. Models receive source references and bounded tools, not raw credentials.
- Execution: one isolated Developer writer per change, committed baseline, frozen independent QA workspace, manual Git integration.

## Quality commands
- pnpm check: typecheck, unit/integration tests, strict OpenSpec validation and production build.
- pnpm test:e2e: Playwright user workflows using disposable repositories/providers.
- docker compose up --build -d: rebuild and start the actual service.
- docker compose logs clinic: retrieve the current private launch URL after restart.

## Validation boundaries
Provider fixtures, disposable SQLite/SSH servers and mocked network drivers are distinct from opt-in live inference and external infrastructure. Do not represent an unrun live check as passed. See ../../docs/verification.md for dated revision evidence.

## Interfaces
REST commands and persisted Server-Sent Events drive the browser. Shared validated schemas define inputs. See ../../docs/api.md for endpoint contracts and ../specs/clinic-api/ for requirements and coverage.
