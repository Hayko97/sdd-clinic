# SDD Clinic

A local workspace for spec-driven development with installed Codex and Claude CLIs. Connect an engine, add a repository, review its OpenSpec setup, and work with specs through prompts and file diffs. Developer, QA, and Product Owner agents share explicit specifications and reviewable evidence.

Clinic uses SDD for its own development. Its accepted capability specifications live in `openspec/specs/`; implementation proposals, designs, and completed checklists are preserved in `openspec/changes/archive/`. See `docs/verification.md` for acceptance evidence and `.clinic/` for its own project and agent configuration.

See the [installation and CLI guide](docs/installation-and-cli.md) for existing-project setup commands, CLI capabilities, and diagrams of browser and external-agent workflows.

## Public installation

For published releases (Node.js 24+ and Docker Compose required):

```sh
npm install --global sdd-clinic
sddclinic start                 # open the GUI
cd /path/to/your-project
sddclinic setup --rebuild       # prepare reconstruction specs and validation
```

The package installs the global CLI and includes the GUI. It pulls the matching `sintyoa/sdd-clinic` Docker image. See [releases](docs/releases.md) for source builds and publishing details. Licensed under [MIT](LICENSE).

## Set up any existing project from the terminal

Install the global command from this source checkout (Node 24+, pnpm and Docker Compose required):

```sh
pnpm install --frozen-lockfile
pnpm install:global
export PATH="$HOME/.local/bin:$PATH"
cd /path/to/your-project
sddclinic setup
```

Default setup opens provider sign-in when needed, selects model/reasoning, and generates initial capability specifications directly from bounded project context. It shows a complete diff and requires explicit application confirmation. Use `--deep` only for an exhaustive source audit. Use `--model gpt-6.1-sol --reasoning medium` for an explicit Codex selection, or `--guidance-only` for reviewed local scaffolding without inference. Successful setup adds the project to the global GUI, including an accessible repository mount. Terminal model authentication remains separate. No public npm release is assumed. See the [installation and CLI guide](docs/installation-and-cli.md) for options, diagrams and limits.

## Run with Docker

Docker Compose is the standard runtime. Set `CLINIC_PROJECTS_DIR` to the host folder containing the repositories you want Clinic to access (defaults to this repository).

```sh
CLINIC_PROJECTS_DIR="/absolute/path/to/projects" docker compose up --build -d
docker compose logs clinic
```

Open the private `http://127.0.0.1:4310/#token=...` URL from the logs. Add repositories using their container paths, such as `/projects/my-app` (or `/projects` for the default mount). The browser port is published only on host loopback. Application state and provider homes persist in the `clinic-home` volume. Do not remove the volume if you want to preserve registrations and history. Do not change the mounted project root while reusing registrations pointing to `/projects`.

The image installs Linux Codex and Claude CLIs. Host macOS executables and sign-in state do not transfer into Docker. In **Connect CLI**, choose **Sign in with ChatGPT** on the Codex card, open the provider page and enter the displayed code. Leave Clinic running; it confirms the container's authentication automatically. Device sign-in may need enabling in your ChatGPT security or workspace settings. Codes are temporary and are cleared on completion, cancellation or expiry. Clinic never copies host authentication tokens.

Terminal sign-in remains available in the same container (required for Claude):

```sh
docker compose exec clinic codex login --device-auth
docker compose exec clinic claude auth login
docker compose exec clinic node dist/server/cli.js doctor
```

Use supported provider credentials; subscription authentication availability depends on the provider. Credentials persist inside the private Docker volume. Database/server secrets use the OS credential store when available, with an encrypted application vault as the Docker fallback. If neither can persist, Clinic labels the source session-only. Python projects must install their own test dependencies; extend the image for other project toolchains. Test suites can run locally with Node 24 and pnpm; keep the application runtime in Docker.

## Project skills and specification flow

Setup proposes `openspec/project/mission.md`, `tech-stack.md`, `roadmap.md` and `workflow.md`, plus a portable native `clinic-sdd` OpenSpec schema with reusable Markdown templates. Existing project documents/schema settings are preserved. Exact old stock skills receive a reviewed upgrade; customized skills remain unchanged. Use **Set up SDD** on an existing project to review additions.

For an existing application, **Inspect & set up** and **Set up SDD** use the project's connected CLI to recursively analyze source, tests, configuration and text documentation. Complete eligible files are sent in batches, including deeply nested files and long-file tails. The resulting proposal combines new `openspec/specs/<capability>/spec.md` files, `openspec/project/baseline-analysis.md`, and the agent guidance files below. The report lists source hashes, covered files/chunks, excluded paths, existing specs reused, and questions where code and documentation disagree. Requirements cite source lines and include observable acceptance scenarios. All inferred behavior needs review; code existence is not evidence of intended behavior or passing tests.

Review the complete diff before **Apply**. Existing capability specs are preserved; follow-up changes use refinement. Editing, adding or removing source files during analysis or before Apply rejects the baseline and requires reanalysis. You can stop a run, reopen its progress, or reload and return to **Review setup proposal**. Failed or interrupted analysis writes no project files and must be retried explicitly.

Dependencies, generated output, Git internals, Git-ignored paths, credentials, symlinks and binary documents/media are excluded and reported. The scanner supports UTF-8 text and redacts credential-like values. Explicit limits are 30,000 entries, 2 MB per text file and 20 MB total text; exceeding a limit or encountering unreadable evidence fails visibly rather than silently truncating. Model context and proposal-size limits can also require narrowing a very large repository. Fixture checks verify coverage accounting and review boundaries; live model interpretation is not guaranteed to recover every requirement correctly.

Without a connected CLI, setup still proposes guidance/skills/documents and clearly states that code-derived specs have not been generated. To choose this mode with a connected CLI, uncheck **Analyze existing code and documentation** when adding a project, or choose **Install guidance files only** in the workspace. Connect the configured CLI and use **Set up SDD** later for analysis.

**New change** previews a complete folder: `research.md`, `proposal.md`, `specs/<capability>/spec.md`, `design.md`, `validation.md`, `tasks.md` and metadata. Select an existing capability when refining it. Draft markers must be resolved before approval, and the Clinic schema requires a validation table mapping every exact scenario title to a concrete check and expected evidence. Put observed results in run evidence; do not rewrite the approved plan to claim success. Add contracts/data-model documents only when relevant.

The workspace exposes shared project guidance and each capability's current documents plus related proposed and archived bundles. Clinic's own ten capability folders include maintained design and validation references. [Research and the full document structure](docs/sdd-practices.md) explain the tutorial mapping and unavailable transcript coverage.

Reviewed setup installs `analyze-request`, `create-spec`, `refine-spec`, and `implement-spec` under `.clinic/skills/`. Provider entrypoints under `.agents/skills/` and `.claude/skills/` refer to these authoritative files. The **Skills** section in each project workspace shows its installed instructions. Customize the canonical SKILL.md; repeated setup preserves it. Existing projects can rerun setup to install missing skills.

Setup also generates native project guidance for these tools, regardless of the project's selected execution engine:

| Tool | Project instruction file |
| --- | --- |
| Codex and other AGENTS.md-compatible agents | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursor/rules/sdd-clinic.mdc` (new rules use `alwaysApply: true`) |

The guidance directs **every development prompt** through analysis of accepted specs and active changes → `refine-spec` when existing intent needs changes and/or `create-spec` for new behavior → review and validation → `implement-spec` → scenario verification. Already sufficient specs are reused. Tools without native skill support read the canonical `.clinic/skills/` files directly. These files provide portable instructions; Clinic's execution engines remain Codex and Claude.

Use **Set up SDD → Review → Apply** to upgrade an existing project. Setup replaces only the exact previous Clinic default block, preserving surrounding text, and adds missing files. Customized or damaged managed blocks and existing Cursor metadata stay unchanged; review those manually if they need the new workflow or broader scope. Repeated setup creates no duplicate blocks. Commit the reviewed guidance and skills with the project so they travel with its Git checkouts. Tool settings, local overrides and whether an external agent follows instructions remain outside Clinic's enforcement.

Creation reviews accepted specs and active changes for duplicate intent, records reuse/modify/new decisions, then defines research, proposal, design, behavioral scenarios, a validation plan and test-linked tasks. Validation and diff approval precede implementation. Implementation requires tests and validation on every pass, followed by independent QA and review, then sync/archive and verified integration. Implementation labels distinguish no recorded implementation, unverified code and current passing QA. Imported specs without Clinic evidence remain **Implementation unknown**.

The workflow follows [OpenSpec concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md) and the [Agent Skills format](https://agentskills.io/specification). Semantic overlap assessment is performed by the selected engine; it is not a deterministic proof that no duplicates exist.

## Use the workflow

1. Connect Codex or Claude by checking the detected executable or supplying its path.
2. Add a local project. Review and apply the generated SDD setup; existing instructions are preserved.
3. Browse current specs, proposed changes, and archives. Select a document and describe your intent in the conversation.
4. Review generated diffs before applying them. Direct edits also produce reviewable proposals. Editing a current spec creates a proposed delta.
5. Complete the research, proposal, design, tasks, acceptance scenarios and scenario-linked validation plan, then approve the change. New capabilities need a meaningful `## Purpose` section. OpenSpec validation must pass.
6. Start Developer. It works in a dedicated branch and worktree from the committed baseline and approved spec snapshot. Unrelated uncommitted files remain untouched.
7. QA runs configured setup/check commands and independently reviews acceptance scenarios in another worktree. Failed and unverified checks remain visible.
8. Finalize a passed review to synchronize and archive OpenSpec on its implementation branch. Integrate using your existing Git workflow, then verify integration in Clinic.

Repeated development uses the prior implementation revision. Task checkbox updates are completion metadata and do not invalidate requirements; edits to requirements, design, or task descriptions do. Changes to accepted specifications, shared project guidance or schema context invalidate dependent approvals and QA evidence.

## Configure agents and checks

Portable project configuration and agent definitions are YAML files in `.clinic/`. The UI edits those same files. Configure project commands as executable-plus-argument arrays, with `phase: setup` or `phase: check`; commands do not pass through a shell. Only trusted project commands should be configured.

The Developer can write within its worktree. QA works from a frozen revision. PO receives connection metadata and bounded broker results, never raw database or SSH credentials. Custom agents run read-only project reports. Per-agent engine/model, instructions, tools, limits, and triggers are configurable. Claude limits provider turns; Codex limits tool steps. Both enforce a wall-clock timeout. Read-only Codex agents use Clinic's bounded file tools with shell execution disabled.

## Product analysis

Paste connection details into the project's Developer composer, select the recipient agent and choose **Save connection**. This works before CLI sign-in. A database URL, JSON/environment credential block, `ssh user@host -p 22` with password or private-key block, and absolute `sqlite:///path/to/database.sqlite` are supported. Use **Paste credentials** for an update or a block that is not automatically recognized. For example:

```text
type: postgres
host: db.example
database: app
user: reader
password: "your password"
```

The input is parsed locally and cleared after saving; it is never saved in browser drafts, sent to the model, or written into repository instructions. Unsupported services or ambiguous prose produce format guidance. Saved sources appear below the composer with their recipient agents, storage status, and **Test**, **Update** and **Remove** actions. Saving configuration does not test connectivity. Updates can contain just the replacement password. Credentials survive Docker restarts when the `clinic-home` volume is retained; the vault's private encryption key lives in that application volume, outside project files.

Agents use assigned sources through Clinic's MCP tools (`list_connections`, `test_connection`, `inspect_schema`, `query_data`, `read_server_file`). Explicit assignment enables the agent's data tool. Developer planning and implementation can inspect an assigned source without receiving its raw credentials. Existing unassigned sources remain PO-only. Connection IDs are local to their project. Arbitrary remote shell access and unsupported service protocols are not implied.

PostgreSQL, MySQL/MariaDB, MongoDB, and SQLite use bounded read-only operations. SSH provides SFTP file reads from allowed paths and database tunnels. Include `fingerprint: SHA256:...` and `paths: /var/log/app,/srv/app/schema` from your verified server configuration; missing access settings produce an actionable error. Container paths must refer to mounted files. Saving another connection for an SSH tunnel can name the saved SSH source ID with `tunnel: ...`.

In **Findings & backlog**, use **Suggest metrics** to propose mappings between features and real schema fields. Review queries, expected behavior, and observation periods before enabling recurring analysis. PO can also inspect permitted server evidence on demand.

SQL accepts a conservative SELECT subset with common analytics functions. MongoDB accepts JSON such as:

```json
{"collection":"events","pipeline":[{"$match":{"status":"failed"}},{"$count":"total"}]}
```

Queries are limited to 1,000 returned rows, 1 MB of evidence, and 15 seconds. Server reads are capped at 64 KiB; `.log` files return the tail. Use aggregates and account permissions to limit sensitive data. Redaction covers credential-shaped fields, connection URLs, and key material; it is not a general personal-data anonymizer.

Findings contain timestamped evidence, expected and observed behavior, uncertainty, priority rationale, and a proposed action. Repeated fingerprints update existing findings. Statistical anomalies remain investigations unless incorrect behavior is established. Convert a finding into a proposed OpenSpec change from the backlog.

Schedules are disabled by default. They run only while the local service is available. Missed intervals are skipped rather than replayed.

## Storage and boundaries

- Repository: OpenSpec artifacts, project context, and portable agent configuration.
- `~/.sdd-clinic/`: local SQLite state, conversations, events, evidence, and isolated worktrees.
- Operating-system credential store or encrypted local application vault: connection secrets; explicitly labeled memory-only fallback if neither is available.

The server binds to `127.0.0.1`, checks Host/Origin headers, and requires an HttpOnly SameSite browser session. MCP tools use short-lived tokens scoped to an active run and project. Interrupted runs preserve their events and workspaces and are never automatically replayed.

macOS and Linux are the primary local targets; Windows users can use WSL. Models still run through the selected provider, so relevant context and redacted evidence are sent to that provider. Clinic does not provide hosted accounts, automatic merging/pushing, deployment, or external tracker integrations. Future integrations are intended to use engine plugins/MCP behind the `IntegrationAdapter` boundary.

## Verify changes

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

Unit/integration tests use temporary repositories, a real SQLite database, and scripted provider protocol fixtures. The delivery fixtures cover TypeScript and Python repositories. Browser tests cover CLI onboarding, setup review, prompted and direct edits, agent configuration, and run inspection.

Live model calls and remote PostgreSQL/MySQL/MongoDB/SSH servers require your own authorized accounts. Fixture results do not imply those live connections were tested. Use **Test conversation**, **Test connection**, schema inspection, and bounded query previews to verify your environment.

An opt-in live smoke test makes a small provider request using your configured CLI authentication:

```sh
CLINIC_LIVE_ENGINE=codex pnpm exec vitest run tests/live.test.ts
# Or CLINIC_LIVE_ENGINE=claude; optionally set CLINIC_ENGINE_PATH.
```

## SDD maintenance

Before changing Clinic behavior, create or update an OpenSpec change with observable scenarios. Update the design when architecture changes, implement the tasks, run the checks, and record evidence. Archive only after the relevant checks pass. Add this repository to Clinic to manage its own next development cycle.

The GUI opens on the global **Projects** dashboard. Every registered repository has its own setup status, spec/agent/skill counts, **Set up SDD** action and **Open workspace** action. **Add project → Inspect & set up → Review → Apply** installs SDD through the GUI without provider authentication. Provider sign-in is required only when invoking AI operations. In Docker use paths under the configured `/projects` mount; set `CLINIC_PROJECTS_DIR` to a parent folder before starting a new workspace to expose multiple repositories.

Opening a project shows one workspace: its Developer prompt, searchable agent cards and schedules, grouped specifications with all related Markdown documents, and installed skills. There is no sidebar or separate Agents page. Settings, documents and run evidence open from this workspace; use **Back to project** or **SDD Clinic · Projects** to return.

The Developer prompt uses the selected project's `analyze-request` skill, then `create-spec` or `refine-spec` when requirements need work. It preserves questions and proposed diffs for review. **Approve specs & implement** validates the reviewed artifacts and hands them to `implement-spec`, isolated development and automatic QA. An unchanged approved change can proceed directly. The GUI retains workflow progress across refresh; a restart records interruption without replaying actions.

The Developer workspace has a chronological chat, readable responses, expandable activity and inline approvals above its composer. **Enter** sends, **Shift+Enter** adds a line, **Up** recalls a prompt from an empty composer, and **Escape** stops active work. `/help`, `/connect`, `/specs` and `/agents` provide local shortcuts. Drafts survive navigation and refresh in the same browser tab, separately for each project and agent. Follow-up prompts include the previous workflow's summary and change while retaining the spec-review gate.

Each agent card supports optional saved schedules. Definitions live in `.clinic/schedules/*.yaml`; execution history stays in local application state. Schedules default to disabled. Developer schedules use the same spec review gate as manual prompts. An active or review-waiting agent causes a skip; missed intervals after restart are not replayed. PO schedules require reviewed metric mappings and QA schedules require an existing implementation target. CLI sign-in and a committed Git baseline are required for actual implementation.

See [Specification index](docs/specifications.md) for capability ownership, [API reference](docs/api.md) for endpoint contracts, and [verification evidence](docs/verification.md) for tested scenarios. Existing projects can use **Set up SDD** to add missing skills without replacing customizations.

## New projects from product material

Choose **New project from a brief** on Projects. Enter a destination inside a mounted workspace, choose Codex or Claude, and supply a prompt, attachments, or both. Save the draft before leaving; drafts and uploads persist in Clinic's application volume. Connect the selected CLI, then choose **Set up SDD**. Answer essential product questions and review the complete package before **Apply SDD setup**. New destination folders are created only on Apply; setup does not initialize Git or start implementation.

Attachments support Markdown, UTF-8 text, PDF, DOCX, PNG and JPEG (20 files, 10 MiB each, 50 MiB total). PDF and DOCX extraction reads text; embedded images/layout need separate image attachments. PDF extraction supports up to 200 text-bearing pages; scanned/empty pages need replacement text or image attachments. Unreadable attachments must be removed or replaced. Text is analyzed in complete batches; images use provider-native image input. Unsupported or excessive content is reported explicitly. Attachments are sent to the selected connected provider during generation.

The reviewed package includes native capability specs, project mission/technology constraints/roadmap/workflow, UI/UX guidance and portable agent instructions. Original documents and images, hashes, the prompt and clarification decisions live under `openspec/project/sources/`. Existing custom guidance and specs are preserved; overlapping intent uses a new refinement change. Applying a baseline records intended behavior, not passing implementation evidence. Draft and source changes invalidate pending proposals.

## Product questions during development

Developer checks for unresolved product intent during analysis, after spec creation/refinement, during implementation, and during QA. Essential questions appear inline in chat with their stage; answer in the composer. Questions and decisions survive reloads and restarts. No timeout implicitly answers a question. Routine technical choices and ordinary failing tests do not require product clarification.

Answering retains the workflow identity and any partial implementation worktree. If the answer changes required behavior, Clinic proposes revised specs and requires review before continuing; previous approval and QA become stale. Unchanged intent can resume implementation or QA. Pending questions block approval, delivery and finalization; changed specification revisions reject stale answers. Cancellation preserves partial files for inspection.

Each new baseline capability includes `openspec/specs/<capability>/spec.md` and a companion `validation.md`. The validation plan maps every qualified requirement/scenario to prerequisites, concrete fixture inputs, actions, assertions and evidence to collect. It labels existing tests (with source references), proposed tests and manual checks separately. Checks start **UNVERIFIED**: setup does not execute application tests or change application code. Initial setup is a bounded overview, not proof that the entire application can be reconstructed identically. Existing companion files are preserved; a conflicting new capability path requires refinement rather than overwrite.

To prepare documents for rebuilding an existing application from an empty codebase, use:

```sh
sddclinic setup --rebuild --model gpt-6.1-sol --reasoning medium
```

This mode analyzes all eligible project text (still excluding dependencies/generated files), creates native specifications and validation companions, and adds `openspec/project/reconstruction.md`. The guide captures purpose, architecture, workflows, interfaces, data, presentation/assets, operations and verification. Unknown areas and missing assets remain explicit blockers. It requires more analysis than initial setup. All output is reviewed before writing; application code is preserved. A reconstruction guide is not evidence of equivalent behavior: implement in a separate empty repository and run the documented comparisons before claiming equivalence. Existing accepted specs are reused; gaps require refinement rather than overwrite.


## Update and repair missing SDD documents (0.1.2)

```sh
npm install --global sdd-clinic@0.1.2
# Run from the existing project; this explicit package bypasses older local launchers:
npx --yes --package=sdd-clinic@0.1.2 sddclinic setup --repair
```

Review and accept the displayed diff. Repair creates missing per-capability validation plans, shared workflow documents, agent skills/instructions and a missing CHANGELOG.md. Existing custom specs, validation and changelog files are preserved. It does not call a model, audit application source or run application tests. Provider-free companion checks are marked **UNVERIFIED / INCOMPLETE** with draft markers. They require concrete fixtures, actions, assertions and prerequisites before implementation approval; repair cannot derive runnable checks from scenario headings alone. An existing root changelog with different capitalization is respected.

For an existing application without specifications:

```sh
npx --yes --package=sdd-clinic@0.1.2 sddclinic setup --model gpt-6.1-sol --reasoning medium
```

Add `--rebuild` only when you want comprehensive source analysis and a reconstruction blueprint. For a new application with no source, run `npx --yes --package=sdd-clinic@0.1.2 sddclinic start` and use the new-project prompt/document flow; it creates specifications plus validation from your product requirements. Empty-code repair cannot invent product intent. Native proposal, research, design and tasks templates are installed for future actual changes, rather than fabricated implementation records.

If `sddclinic` still behaves like an older version, inspect `type -a sddclinic`; an earlier local wrapper can precede the npm executable on PATH. The versioned npx commands above select the published version explicitly. Node.js24+ and Docker Compose are required.

## Setup quality review (unreleased source changes)

Analyzed setup now requires a separate evidence-based quality review before offering a proposal. It covers architecture, interfaces/data, UI navigation and states, responsive behavior, accessibility, visual references, localization, authentication, security, operations and nonfunctional constraints. Unsupported areas remain explicit unknowns; backend-only UI topics need justified not-applicable reasons. Source-derived observations, unmet requirements and owner decisions remain distinct. A contradiction between required behavior and current code is an implementation gap, not permission to weaken the requirement.

Missing project guidance is rendered from that review. Existing custom documents remain authoritative and are listed for reconciliation. Exact previous Clinic design/validation templates may be upgraded; customized templates are preserved. `openspec/project/setup-review.md` records gaps/decisions, source hashes, generated OpenSpec artifact hashes and the exact managed CLI version. Source hashes describe inspected bytes, including dirty files; they do not contain a source backup or prove a commit, approval or test result. Actual execution evidence belongs in a separate verification report.

Initial mode remains a bounded sample with omissions; `--deep` analyzes all eligible text. Structural validation and a bounded model review cannot prove semantic completeness. A blocking generation defect stops setup before project writes; refine the source intent or regenerate instead of treating a failed review as successful setup. Existing specs and custom files are never silently replaced. These changes are included in release 0.1.2, together with bounded consolidation, exact citation provenance and batched original-evidence review.
