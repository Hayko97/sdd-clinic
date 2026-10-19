# Local API reference

The browser uses one root URL, with project navigation in the interface. The REST endpoints below are implementation contracts, not additional pages to navigate manually. `/api/session` exchanges the private launch token for an HttpOnly SameSite cookie. Other API calls require that session; Host/Origin checks reject foreign browser origins. Errors return a non-2xx status and `{ "error": "actionable explanation" }`. Missing or foreign-project resources return 404; workflow conflicts and stale writes return 409.

## Workspace and setup

| Method and path | Input / result |
| --- | --- |
| `GET /api/state` | Connected engines, ephemeral login states, runtime (`docker` or `local`), and registered projects with setup status and spec/agent/skill counts |
| `POST /api/projects` | `path`, `engine`, optional `name`; registers a repository |
| `GET /api/projects/:projectId` | Repository-backed configuration, agents, skills, specs, proposals, changes, conversations; workflows, agentSchedules, runs, findings and evidence references |
| `GET /api/projects/:projectId/inspect` | Detected structure, commands and setup questions |
| `POST /api/projects/:projectId/setup` | `{mode?: "auto" \| "files" \| "analyze"}`. Auto (default) starts a setup-analysis run with the configured connected engine, otherwise returns a files-only proposal and analysisMessage. Files skips inference; analyze requires the configured engine. Preserves existing specs and custom instructions. |
| `PUT /api/projects/:projectId/config` | Validated portable project configuration |
| `POST /api/projects/:projectId/agents` | Validated agent definition, including ID, role, engine, instructions and limits |
| `POST /api/engines/:kind/connect` | Probe/configure the chosen CLI |
| `POST /api/engines/:kind/login` | `{ "path": "codex" }`; starts supported device sign-in and returns immediately. Currently Codex only. |
| `GET /api/engines/:kind/login` | Ephemeral status: idle, starting, waiting, connected, failed, canceled or expired. Waiting includes `verificationUrl`, `userCode` and `expiresAt`. |
| `POST /api/engines/:kind/login/cancel` | Stops the pending attempt and clears its code/link. |
| `POST /api/engines/:kind/test` | Start an explicit provider conversation test |

Login endpoints require the browser session and origin checks. Only one check/sign-in per engine may run at once; changing executable or starting another attempt while signing in returns 409. A new CLI probe must confirm authentication before Connected. Device challenges are never stored in SQLite or replayed after restart. Sign-in does not make an inference request; the connection test remains explicit.

## Developer workflow

All paths below start with `/api/projects/:projectId`.

| Method and suffix | Contract |
| --- | --- |
| `POST /workflows` | `{ "prompt": "...", "agentId": "developer", "previousWorkflowId": "optional ID" }`; creates a persisted workflow and starts analysis. Uses the project's agent and CLI. Previous context must belong to the same project/agent and be completed or stopped. A second active workflow for that agent is rejected. |
| `POST /workflows/:id/continue` | Optional `{ "answer": "..." }` for clarification; otherwise explicitly applies the reviewed proposal, validates, approves and starts development. Changed proposal bases or reviewed revisions are rejected. Concurrent continuation is rejected. Failed/interrupted attempts can be retried explicitly. |
| `POST /workflows/:id/cancel` | Cancels active related work; preserves prompt, run evidence and workspaces. Also works when waiting for clarification or review. |
| `PUT /agent-schedules/:id` | `{ "agentId": "developer", "prompt": "...", "intervalHours": 24, "enabled": false }`; optional `change` required for QA. Saves `.clinic/schedules/:id.yaml`. Interval: 1–8760 hours. Ownership and task inputs are validated before writing. |

Read workflow and schedule state through the project GET response. Workflow stages are `analyzing`, `specifying`, `needs-input`, `awaiting-review`, `continuing`, `implementing`, `qa`, `review`, `failed`, `interrupted`, and `canceled`. Records include project/agent IDs, original prompt, timestamps, and relevant run/proposal/change IDs. A `review` result still requires revision-bound implementation review and integration; it is not Done.

Schedules include enabled state, next/last occurrence, latest outcome and skipped count. Reads reconcile recorded outcomes without launching providers. Startup records missed intervals instead of catching up. A scheduled prompt never grants spec approval.

## Specifications and delivery

Paths start with `/api/projects/:projectId`. `POST /changes` accepts `{name,title,description,capability?}` and returns the draft change record plus a pending `proposal` containing the complete feature bundle. It does not write files until `POST /proposals/:id/apply`. `capability` selects an existing or new capability; when omitted it uses the change identifier. `POST /edit` accepts `{path,content,baseHash}` and proposes a conflict-safe Markdown edit. Project guidance and supporting capability design/validation references are reviewed edits; accepted `spec.md` changes become deltas. `POST /chat` starts a spec conversation. `/proposals/:id/reject` discards a reviewed diff.

Project files have `kind: project|spec|change|archive`; shared guidance lives under `openspec/project/`. Global `specCount` counts current `spec.md` files, excluding supporting documents. Setup includes missing guidance/schema templates and reviewed upgrades of exact old stock skills, preserving customized content.

The `clinic-sdd` schema requires research, proposal, design, validation and task documents plus native behavioral deltas. Approval rejects unresolved `[CLINIC:DRAFT]` markers and missing validation rows (`Scenario | Check / procedure | Expected evidence`, using exact scenario titles). These are planning checks, not passing runtime evidence. Shared project guidance and schema revisions participate in approval hashes and are copied into implementation workspaces. Existing external schemas retain their previous approval behavior.

A change exposes `POST /changes/:name/validate`, `/approve`, `/develop`, `/qa`, `/finalize`, and `/integration`, plus `GET /changes/:name/review`. These retain OpenSpec validation, a committed Git baseline, isolated workspaces, automatic independent QA and current revision evidence as described in the delivery/spec-workspace capabilities. `/finalize` does not merge or push.

## Run evidence and analysis

`GET /api/runs/:id` returns run details. `GET /api/runs/:id/events` streams persisted SSE events and accepts a replay cursor. `POST /api/runs/:id/cancel` interrupts an active run; `POST /api/runs/:id/approvals/:approvalId` answers its pending approval. Project run history uses the selected project response, not a cross-project list.

`POST /api/projects/:projectId/connection-prompt` takes `{ "prompt": "transient connection details", "agentId": "developer", "connectionId": "optional ID for update" }`. It parses supported URLs/credential blocks locally, validates ownership and agent assignment, saves secrets separately and returns a non-secret `{ connection, message }` receipt. It does not create a workflow or call a provider. Repeated endpoint identity updates the existing profile; explicit updates preserve an omitted password. Unsupported/ambiguous input returns format guidance without echoing the input. Inputs are limited to 64 KB.

Project-owned connection commands remain under `/api/projects/:projectId/connections`: create, test, schema, bounded query, bounded server-file read and delete. Profiles include `agentIds`, `secretStorage` (`keyring`, `encrypted`, `session` or `none`) and `updatedAt`; no secret fields are returned. The browser exposes these through project chat. Metric commands are under `/metrics`; `/analyze` starts PO work. `/findings/:id` updates a finding and `/findings/:id/convert` proposes a change. `/evidence/:id` returns evidence after ownership checks. Broker credentials never enter repository configuration or model output. The legacy PO `/schedule` endpoint remains compatible; saving a PO agent schedule disables its old timer to avoid duplicate dispatch.

`POST /mcp/:id` uses a separate short-lived run token and agent-scoped broker tools. Agents with the data tool can list/test/inspect/query/read only assigned connections. Old profiles without `agentIds` remain PO-only. Every data operation checks project and agent ownership; PO metric prefetch observes the same grants. It is not a browser navigation endpoint.

## Product-source setup drafts

`GET/POST /api/setup-drafts` list/create durable drafts. Creation takes `{name,destination,engine,prompt}`; an absent destination is staged outside the project until Apply. `GET /api/setup-drafts/:draftId` includes draft status, attachments, pending clarification and review proposal. `PUT` accepts `{prompt}` and invalidates an older review. Destinations must have an existing mounted parent directory; symbolic-link destinations are rejected.

`POST /:draftId/attachments` takes `{name,base64}` with a route-specific 14.1 MB JSON body limit; decoded files are limited to 10 MiB each, 20 files and 50 MiB per draft. `GET/DELETE /:draftId/attachments/:attachmentId` preview/download or remove an attachment. Metadata records extraction errors; generation refuses unreadable inputs. Attachments remain in private local application storage until reviewed application copies originals into the project.

`POST /:draftId/generate` takes `{}` or `{questionId,answer}` for the current clarification. It starts an asynchronous run and retains the draft on missing provider access. `POST /:draftId/cancel` interrupts generation. `POST /:draftId/apply` applies the reviewed package and returns the draft with its registered project ID. Product proposals include `source: product`, `setupDraftId` and optional base64-encoded original-source FileEdits; they can only be applied through their draft. Existing setup modes are unchanged.

## Durable clarification

Workflow responses include `clarificationId`, `resumeStage`, and `clarifications` history with question/answer, stage, change, spec hash and code revision where available. `POST /projects/:projectId/workflows/:id/continue` requires `{questionId,answer}` when answering; an obsolete ID or spec revision is rejected. Answers preserve the workflow ID and partial worktree. Changed intent returns to specification review. Pending clarification records survive restart, unlike transient tool approvals; they block approval, QA/finalization and dependent implementation. Direct Developer/QA runs that stop for product questions appear in Developer chat for continuation.
