## Overlap and supersession
This change replaces the three pending UI/Developer drafts, preserved under docs/superseded-drafts. Existing configurable roles, prompt proposals, conflict-safe editing, isolated implementation, independent QA and integration tracking remain the source of truth. New capabilities own orchestration, scheduling and API behavior separately. UI requirements do not duplicate those mechanics.
## Architecture
Use one project overview component for the home/workspace transition; retain existing document/diff and configuration dialogs as contextual views. No new browser routes. Group documents from native OpenSpec paths, linking change artifacts by capability deltas. Show unassigned changes and archives explicitly.
Use durable workflow records in SQLite and existing provider adapters behind Runs. Analysis returns a validated action (create/refine/implement/clarify) with selected path/change. A reviewable spec proposal is bound to base revisions; continue applies, validates and approves before the existing Developer/QA path. Capture exact skill content hashes per stage. Restart marks unfinished provider runs interrupted; no automatic replay.
Schedules live in .clinic/schedules YAML; SQLite stores next occurrence and history. Claim due occurrences synchronously before asynchronous dispatch. Agent-level overlap checks include workflows awaiting review. Existing legacy PO scheduling remains readable and is disabled when replaced by a PO-agent schedule to avoid duplicate timers.
## Endpoint contracts
- GET /api/projects/:projectId includes workflows, agentSchedules and runtime outcomes alongside existing project data.
- POST /api/projects/:projectId/workflows accepts prompt and agentId; returns a workflow.
- POST /api/projects/:projectId/workflows/:id/continue accepts optional clarification answer; otherwise applies reviewed proposal and starts implementation.
- POST /api/projects/:projectId/workflows/:id/cancel stops active related work and records cancellation.
- PUT /api/projects/:projectId/agent-schedules/:id accepts agentId, prompt, optional change, intervalHours and enabled.
All routes use existing cookie/origin validation, error mapping and project ownership checks. Existing REST/SSE run endpoints provide evidence.
## Constraints
The current checkout has no initial commit, so work here cannot claim isolated implementation/integration. Preserve unrelated work. The product itself still requires a committed baseline for implementation runs. External live providers remain opt-in.
