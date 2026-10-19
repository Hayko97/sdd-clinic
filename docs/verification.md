# SDD Clinic 0.1.0 — verification record

Verified locally on 2026-10-17 with Node.js 24.19.0 and Git 2.53.0. Clinic's behavior was defined in the `build-clinic` OpenSpec proposal, design, tasks, and six capability specifications before implementation. Portable configuration and default agents are in `.clinic/`.

## Automated evidence

| Capability | Evidence |
| --- | --- |
| Repository setup and specs | `tests/specs.test.ts`: repeated setup, preserved instructions, schema discovery, all-file stale-write rejection, path/symlink protection, project ownership, approved revision invalidation, task completion metadata, and context revision checks |
| Provider conversations | `tests/engines.test.ts`: both protocol fixtures, session resume, incremental messages, approvals, malformed output, interruption, and unavailable executables |
| Delivery | `tests/delivery.test.ts`: complete TypeScript and Python fixture workflows, untouched source checkout and unrelated uncommitted files, independent QA workspaces, failed versus unavailable checks, changed implementation rejection, repeated QA on a new manual commit, code diff, OpenSpec archive, and verified Git integration |
| Runtime and findings | `tests/api.test.ts`: session and Origin/Host enforcement, cross-project evidence rejection, anomaly classification, recurring-finding deduplication, evidence-to-change conversion, and skipped schedules |
| Credential and query boundaries | `tests/data.test.ts`: real SQLite, bounded rows, evidence recording, conservative SQL/Mongo restrictions, credential redaction, and session-only secret recovery |
| Network database contracts | `tests/connectors.test.ts`: PostgreSQL/MySQL read-only transactions, cleanup, query limits and timeouts; Mongo bounded aggregation with disk use disabled. Driver calls are mocked. |
| Server access | `tests/ssh.test.ts`: real local SSH handshake and SFTP, fingerprint mismatch rejection, canonical path restrictions, redacted reads, and forwarded sockets against a disposable server |
| MCP permissions | `tests/mcp.test.ts`: real HTTP MCP client/server exchange, run-token scoping, bounded source reads, excluded secrets, path rejection, role-specific tools, approval queue and decision delivery |
| Browser workflow | `tests/e2e/workspace.spec.ts`: CLI connection, project setup diff, prompted and direct edits, retained conversation, agent settings, run inspection, and narrow-layout overflow check; screenshots visually reviewed |

`pnpm check` passes type checking, **40 unit/integration tests**, strict OpenSpec validation, and the production build. `pnpm test:e2e` passes the browser acceptance workflow. The two live-provider tests are intentionally skipped unless explicitly enabled.

## Installed-provider and package checks

- `pnpm run doctor` finds authenticated Codex CLI `0.162.0-alpha.17.2` and reports missing Claude CLI accurately.
- The installed Codex app-server accepts initialization and a read-only thread with the configured protocol options. This check makes no model inference request.
- `pnpm pack --pack-destination releases` produces `releases/sdd-clinic-0.1.0.tgz`.
- A clean production dependency installation serves the packaged HTML and JavaScript successfully and resolves and runs the bundled pinned OpenSpec CLI.
- Repeating Clinic's own setup produces zero additional file changes.

## Explicitly unverified environments

Live model inference, Claude authentication on this machine, external PostgreSQL/MySQL/MongoDB instances, remote SSH infrastructure, and the user's OS keyring have not been exercised. Local protocol fixtures, mocked driver contracts, the real SQLite fixture, and the disposable SSH server are separate evidence from those live environments.

Use Connect CLI for provider authentication and the project's inline chat sources to test a real data/server environment. `tests/live.test.ts` provides opt-in model smoke checks; see the README. No project has been pushed, merged outside disposable tests, deployed, or published to a package registry.

## Working with Clinic's own next change

Add this repository in Clinic, connect an installed engine, and select an accepted capability under `openspec/specs/`. Prompting an edit creates a new OpenSpec proposal. The repository must have a committed Git baseline before starting its first isolated implementation run; specification browsing and editing work before that commit.

## Project skills increment (2026-10-18)

- Default create-spec and implement-spec installed through the reviewed setup proposal; idempotent setup and preservation of a customized skill verified in the spec integration test. A second project returns its own empty skill set.
- Browser acceptance navigates to Skills after setup and verifies both project defaults, then completes the existing prompt/diff workflow.
- `pnpm check`: 40 fixture tests passed, two opt-in provider tests skipped; typecheck, strict OpenSpec validation and production build passed.
- `pnpm test:e2e`: one full browser workflow passed.
- Both canonical skills passed skill-creator's quick_validate.py using an isolated Python environment.
- Semantic overlap review is instructed and supplied accepted/pending spec context; live model duplicate analysis is not claimed as tested.
- Docker image built and container served HTTP 200 on host loopback. After restart, authenticated API retained the SDD Clinic registration at `/projects` and returned both installed skills.
- Container doctor detected Codex 0.163.0 and Claude 2.1.302 as compatible; both are unauthenticated. Live model execution remains opt-in and untested.

## Global project dashboard (2026-10-18)
- pnpm check: 41 tests passed, two live-provider tests skipped; typecheck, spec validation and build passed.
- pnpm test:e2e: three browser workflows passed, including global landing and setup of a second repository without a connected provider in the UI.
- API acceptance verifies registration and reviewed setup with no configured provider, accurate installed counts, and idempotent registration.
- Actual Docker GUI opens Projects and displays SDD Clinic as Set up with 7 specs, 3 agents and 2 skills; Open workspace navigation verified with Playwright.

## Agent cards and refinement skill (2026-10-18)
- `pnpm check` passed: typecheck, 42 unit/integration tests, strict validation of all 11 current specs/changes and production build. Two opt-in live-provider tests skipped.
- `pnpm test:e2e` passed all three browser workflows, including agent search/no-results/reset, expandable instructions, named configuration actions and a 375px single-column layout without horizontal overflow.
- Provider fixture verifies customized project refine-spec content is supplied for an existing change, the selected skill is recorded, and a missing refine-spec prevents provider dispatch. Setup tests verify customized refine skills survive repeat setup.
- Skill Creator quick_validate.py passed for the canonical refine-spec skill. Semantic quality of live model refinements was not exercised.
- Docker rebuilt and served the actual three-card agent page; Playwright verified the installed refine-spec and 375px page width. Desktop and mobile screenshots inspected locally.
- The existing overlong accepted management-views requirement was shortened without changing its behavior; full strict validation now passes.
- The checkout still has no initial commit: these changes were made without an isolated Git implementation branch, and no merge/integration is claimed. Pending Developer orchestration and schedule drafts remain unimplemented.

## Unified project workspace and Developer workflow (2026-10-18)

The `project-workspace-flow` proposal/design/scenarios were written before behavior changes. Three overlapping pending drafts were preserved under `docs/superseded-drafts`; their status is superseded, not separately implemented.

- `pnpm check` passed: typecheck, **50 unit/integration tests**, strict OpenSpec validation and production build. Two opt-in live-provider tests were skipped.
- `pnpm test:e2e` passed **three browser workflows**: project home/setup and inline agents/schedules/docs; a second project without a connected CLI; and a complete Developer prompt → analyze/refine → reviewed diff → implementation → QA, including browser-refresh persistence and exact spec/code revision checks.
- `tests/workflows.test.ts` covers creation/refinement skill routing, configured CLI override, current approved-change reuse, clarification/cancellation, missing skills, stale proposals and spec snapshots, concurrent start/continue rejection, restart recovery, cross-project rejection, schedule validation, offline/overlap skips and visible scheduled outcomes. Provider inference is fixture-backed.
- `tests/workspace.test.ts` verifies grouping current capabilities, every linked change document, new capabilities and incomplete/unassigned changes without losing document access.
- Setup installed `analyze-request` in Clinic's canonical skills and both provider entrypoint directories; repeat setup proposed zero files. Skill Creator `quick_validate.py` passed. Existing customized skills remain unchanged; Clinic's own Developer instruction was explicitly updated for the pipeline.
- Docker was rebuilt and the served project home/workspace was inspected with Playwright. It has no sidebar, three agent cards, four skills and ten specification groups. Desktop and 375px mobile screenshots were inspected; long expanded Markdown paths wrap without horizontal overflow. Screenshots are in ignored `test-results/docker-*.png` files.
- Source/test digest (sorted relative paths, NUL separator, file bytes, NUL separator; 34 files under `src/` and `tests/`): SHA256 `b14aca2b2246224e7e7eabd4f94f17920fba4a29d72379b8cb93958bfba1424e`.

The working checkout still has no initial commit. This delivery is local, with no isolated self-implementation branch, merge or verified integration claimed. The product's isolated delivery behavior is verified in disposable committed repositories. Live Codex/Claude model execution and external databases/servers were not run; provider sign-in inside Docker and a committed project baseline remain prerequisites for actual Developer implementation runs.

## Docker Codex sign-in and Developer chat (2026-10-18)

The `container-login-chat` change defines runtime-owned device sign-in, a conversational Developer workspace and scoped follow-up context. It reuses the existing connection, interface and workflow capabilities. The implementation and evidence were recorded before synchronizing these requirements into accepted specs.

- `pnpm check` passed typecheck, **55 unit/integration tests**, strict OpenSpec validation and the production build. Two opt-in live-provider tests were skipped.
- `pnpm test:e2e` passed **four browser workflows**. The Developer scenario now explicitly selects Codex, follows reviewed specs through implementation and QA, tests inline provider questions and cancellation, Enter/Shift+Enter/IME/Up/Down/Escape, draft recovery after navigation/reload, separation between projects, and long content at 375px. The initial project workflow also exercises the Claude fixture.
- `tests/auth.test.ts` verifies real subprocess protocol fixtures for successful device sign-in, rejection, cancellation, duplicate attempts, path conflicts, expiration, restart and unknown authentication. Codes remain ephemeral; the completed engine record contains no device code. Unauthenticated HTTP access is rejected. Existing engine tests cover missing executables and unsupported protocols.
- `tests/workflows.test.ts` verifies bounded prior context for the same project/agent and rejection of foreign context. Follow-up still uses the skill pipeline and review gates.
- Browser verification exposed a Git index-lock race between status polling and Developer commits. Read-side optional index refresh is now disabled. Both language fixtures touch a tracked file's timestamp and assert that review leaves the index bytes unchanged; normal committed delivery still passes.
- Docker was rebuilt and restarted at host loopback port 4310. Playwright verified the served project workspace, ten spec groups, three agents and four skills. Desktop and mobile screenshots were inspected; there is no horizontal page overflow at 375px. Existing failed workflow history is preserved.
- **Live authentication transport only:** the installed Docker Codex 0.163.0 returned a device challenge at `auth.openai.com`; the GUI displayed the waiting state and cancellation cleared the code. The attempt was canceled after verification. No account authorization or live model inference was performed. The user must complete **Connect CLI → Sign in with ChatGPT**. A fixture sign-in success does not establish access to the user's account or subscription.
- Source/test digest: **39 files**, sorted relative paths + NUL + file bytes + NUL; SHA256 `8a73a0e092424034751eac4ce5bd5400151c07045e31ef8e0d9ab43727783e75`.
- Spec delta digest before archive, using the same algorithm over `openspec/changes/container-login-chat/specs/`: **3 files**, SHA256 `2b4c8c975305ed8d03e22b8e03654b0501c54fac6f8a0c3f378f5fe54f0b451d`.

The checkout still has no initial commit. There is no isolated self-implementation branch or verified integration; archival is a specification/evidence operation, not a claim of Git integration. Claude account authorization, live model execution and external services remain unverified.

## Connections in project chat (2026-10-18)

The `chat-connections` change refines product-analysis and clinic-interface requirements before implementation. Project chat accepts supported connection URLs, SSH commands and credential blocks, with explicit agent assignment and inline source controls. The separate data/server setup form was removed; provider sign-in stays in Connect CLI.

- `pnpm check` passed typecheck, **64 unit/integration tests**, strict validation of all 11 specs/changes and the production build. Two opt-in live-provider tests were skipped.
- `pnpm test:e2e` passed **five browser workflows**. The connection workflow covers automatic credential mode, no secret persistence in browser drafts or transcripts, saving without a connected CLI, agent selection, reload, deduplication, password updates, testing a real SQLite connection, removal, project separation and 375px layout. Switching projects immediately before pasting also verifies rejection of stale project responses and prevents editing the previous project's composer.
- `tests/connection-input.test.ts` covers URL/environment/JSON/SSH parsing, fixed errors for unsupported or ambiguous input, public metadata without secrets, assignment and foreign-project rejection. A real HTTP MCP client queries a disposable SQLite database as an assigned Developer; unassigned and foreign sources and write queries are rejected.
- Vault tests verify encrypted files without plaintext, private file permissions, recovery using a new vault instance, tamper rejection, deletion and explicit session-only fallback when secure persistence is unavailable.
- Docker was rebuilt and restarted at host loopback port 4310. Two separate disposable containers using the application's persistent volume saved and recovered a synthetic encrypted credential; the test entry was then deleted. This verifies Docker volume persistence independently of an in-memory cache. The OS keyring remains unverified.
- Playwright checked the actual Docker workspace, agent recipient selection, credential mode and absence of the old data setup form. Desktop and 375px screenshots were visually inspected, with no horizontal overflow. This visual check saved no credentials or project data. Screenshots are in ignored `test-results/docker-credentials-chat-*.png` files.
- Source/test digest: **44 files**, sorted relative paths + NUL + file bytes + NUL; SHA256 `175df1ff09b1dcae6a07c4dfe0750f5c57ac1f90e138756122897ebe07b4d562`.
- Spec delta digest before archive, using the same algorithm over `openspec/changes/chat-connections/specs/`: **2 files**, SHA256 `85a2882a674183ff4e923e9c67da1ab06e1e2f08c4e3b07aadc8c812c6f38c08`.

Credentials stay behind the broker; agents receive assigned connection references and bounded read-only tools. Saving does not establish connectivity. External PostgreSQL/MySQL/MongoDB/SSH services and live Codex/Claude inference were not run. The checkout still has no initial commit, so this archive records verified local requirements and evidence without claiming isolated self-implementation or Git integration.


## Complete SDD documentation kit (2026-10-18)

The `sdd-documentation-kit` proposal, research, design and acceptance scenarios were written before implementation. Clinic's own change then adopted its native `clinic-sdd` schema and scenario-linked validation plan. Primary-source research and transcript-access limitations are documented in [sdd-practices.md](sdd-practices.md).

- `pnpm check` passed: typecheck, **70 unit/integration tests**, strict validation of all 11 active specs/changes, and production build. Two opt-in live-provider tests were skipped.
- `pnpm test:e2e` passed **six browser workflows**. The new workflow edits project guidance through a reviewed diff, reads an archived design within its capability, reviews and applies a complete seven-file draft for an existing capability, verifies all six Markdown documents and checks 375px overflow. Existing chat, connection, provider-login and delivery workflows still pass.
- `tests/documentation.test.ts` exercises the actual pinned OpenSpec schema validator, JSON artifact status and validation instructions. It checks safe stock-skill upgrades, preservation of custom files/configuration, idempotent setup, pending drafts that write nothing until applied, draft/missing-coverage rejection, legacy metadata compatibility, stale shared-context invalidation, cross-project edits and capability counts independent of supporting files.
- A complete Clinic-schema change is implemented in a disposable Git worktree and independently verified by the provider fixture. Assertions verify unchanged validation plans, exact approved hashes and copied project guidance/schema templates. This is fixture evidence, not live model inference.
- All four canonical project skills passed Skill Creator's quick_validate.py. Their prompt routing and guidance references are fixture-tested; semantic quality of a live model's research/spec authoring remains unverified.
- Setup was applied to Clinic itself using the proposal/application machinery; a repeated setup proposed zero changes. Its new change passed the same Clinic-schema approval checks in a disposable in-memory application store. The live user's workflow state was not altered by that check.
- Docker rebuilt and restarted successfully. Playwright verified the served Projects grid counts **10 capabilities**, and the workspace exposes **30 current capability documents**, **4 project guidance documents**, three agents and four skills. All ten groups have related feature history; design/validation reading and desktop/375px layout passed. Screenshots in ignored test-results/docker-documentation-*.png were visually inspected. This walkthrough changed no user records.
- Source/test digest: **46 files**, sorted relative paths + NUL + file bytes + NUL; SHA256 `94891b9fc8ff647cb58f18fd6d84087da122ea87e1c86d38b3c61cf3bc984f73`.
- Spec delta digest before archive, same algorithm over openspec/changes/sdd-documentation-kit/specs/: **3 files**, SHA256 `8ebc8756165b8fb883afe3450acaf601c4ab3d5019c1070ea05aa4c3bb97a52f`.

The complete course transcripts were inaccessible; no claim of reviewing all videos is made. The official published exercises, skills and examples informed original templates. Existing project setup remains reviewable; arbitrary third-party applications do not receive fabricated approved requirements or passing validation reports. Live provider/external-service checks remain unverified. The checkout still has no initial commit, so archival records local requirements and evidence without claiming isolated self-implementation or target-branch integration.

- Final project documentation/schema/canonical-skill digest (15 files, same algorithm): SHA256 `346dab53ce3b8da9245465631453621f727ec378a46d2c41a0deb17a14ee2983`.
- After archival, strict validation passed for all ten accepted capabilities and the native clinic-sdd schema.

## Portable agent instructions (2026-10-18)

The `portable-agent-instructions` proposal, primary-source research, design, six acceptance scenarios and validation plan were written and strictly validated before implementation. Setup now proposes AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md and .cursor/rules/sdd-clinic.mdc with a shared workflow for each development request. Existing default Codex/Claude blocks are upgraded without replacing surrounding project instructions.

- `pnpm check` passed: typecheck, **81 unit/integration tests**, strict validation of all 11 active specs/changes, and production build. **Two opt-in live-provider tests were skipped.**
- `pnpm test:e2e` passed all **six browser workflows**. Setup acceptance opens the diff for every native instruction file, verifies the specification workflow and absence of writes before Apply, then reads the generated files after application. The first test run exposed a new test synchronization issue: the project heading was already visible before setup finished. Waiting for the review dialog to close fixed the assertion; the complete suite then passed. Typecheck and formatting checks passed after that test edit.
- `tests/agent-instructions.test.ts` adds **11 fixture cases** covering both engines, all native file paths and canonical skill references, the analysis/refinement/creation/review/implementation/verification sequence, LF/CRLF stock-block upgrades, surrounding-text preservation, custom files and Cursor metadata, customized/partial/duplicate managed blocks, repeated setup, stale proposal rejection, symbolic directories and unsupported setup paths. No external agent compliance is inferred from text assertions.
- Clinic's own setup used an in-memory Store with the normal proposal/application machinery. Exactly five instruction files were created/upgraded; prefix/suffix assertions verified that existing instructions survived. Repeat setup proposed **zero files**. No live application workflow records were modified by this adoption check.
- The complete change passed Clinic's own schema/coverage approval checks in the disposable Store. Final pre-archive context hash: `36f901e1053f98fd2bddcb89e3de8454d4cc8f8e68948ddeca2d439aec99147e`.
- Docker Compose rebuilt and restarted the application successfully. Host-loopback HTTP returned **200**. The built container's setup code recognized all five instruction targets and proposed zero additional files for `/projects`.
- Source/test digest: **48 files** under `src/` and `tests/`, sorted relative paths + NUL + bytes + NUL; SHA256 `bce081584b68d47fea5fcc8ae46e726e222a7682407f0f99b724bd7794a82c0b`.
- Pre-archive spec delta digest, same algorithm over `openspec/changes/portable-agent-instructions/specs/`: **one file**, SHA256 `873d27d0db43c89211b92be52a255572f93a254a55199907041349b2c01805be`.
- Generated project instruction digest, same algorithm over the five paths above: SHA256 `5bd730b38050ff8885d3a48f788e8ef4f73118db07d4185dbab50845102ca601`.
- OpenSpec synchronized the portable-instructions requirement into `spec-workspace` and archived the change under `2026-10-18-portable-agent-instructions`. Post-archive strict validation passed for all ten accepted capabilities and the `clinic-sdd` schema. The archive task was marked complete only after that operation succeeded.

The working tree has no initial commit. This records local fixture verification and specification synchronization, without claiming isolated self-implementation, independent live-agent QA or target-branch integration. Codex/Claude model inference, Gemini/Copilot/Cursor execution, and external services were not run. Custom overrides or disabled tool instruction loading remain outside the enforcement provided by these repository files. Execution adapters remain Codex and Claude.

## Existing-project specification baseline (2026-10-18)

The `existing-project-baseline` proposal, research, design, nine acceptance scenarios and validation plan were written and strictly validated before implementation. Setup now uses the configured connected CLI to analyze eligible source, tests, configuration and text documentation recursively, then proposes native capability specs, a coverage/evidence report and portable agent guidance through the existing reviewed application flow. The analysis labels inferred behavior and unresolved questions; applying it does not establish implementation correctness or passing tests.

- `pnpm check` passed typecheck, **98 unit/integration tests**, strict validation of all 11 active specs/changes and the production build. **Two opt-in live-provider tests were skipped.** After the final change to explicitly report exclusion of a previously generated baseline report, all **17 setup-analysis tests**, typecheck and the production build passed again.
- `pnpm test:e2e` passed all **seven browser workflows**. The new setup workflow covers deeply nested source/documentation, complete spec/report diffs with no writes before Apply, reload recovery of the review action, application, generated capability navigation, agent files and 375px layout. Existing Developer-to-QA, connections, login, documentation and offline setup workflows still pass. Test updates account for setup's additional run and report; a timing failure was resolved by waiting for Apply to finish before changing the project configuration.
- `tests/setup-analysis.test.ts` supplies **17 fixture cases** across both Codex and Claude, complete long-file/chunk delivery, acknowledgement and citation validation, bounded consolidation, existing specs, custom instructions/reports, repeat setup, empty repositories, source edits/additions/removals, stale targets, unreadable files, limits, cancellation, concurrent starts and restart recovery. Exclusion checks cover Git-ignored paths, dependencies/generated output, credential files, binary files and symlinks. Provider fixtures verify protocol and workflow behavior; acknowledging chunks is not proof that a live model understands every behavior.
- The change passed Clinic's native schema and exact scenario/check coverage approval in a disposable in-memory Store without changing live workflow records. Pre-archive context hash: `ce393d1fbee41d9242f45cf56a267ec27e242c0d60cfa0ea9acbe3d841769cb2`.
- Docker Compose rebuilt and restarted the final source successfully; the served application returned HTTP **200**. Playwright verified the default analysis checkbox, existing-project analysis panel, guidance-only action and desktop/375px layout with no page errors or horizontal overflow. Screenshots in ignored `test-results/docker-baseline-*.png` were visually inspected. This walkthrough made no project writes or provider calls. The final image manifest list is `sha256:16328647008a18b5422226aa6680ec18e936cad7774d6f679716b7679b431e3b`.
- Source/test digest: **51 files** under `src/` and `tests/`, sorted relative paths + NUL + file bytes + NUL; SHA256 `6398909b880f32e3ac74d2e08f6ed0ad1108343ef22d6be8f2db682d5f7f241c`.
- Pre-archive spec delta digest, same algorithm over `openspec/changes/existing-project-baseline/specs/`: **two files**, SHA256 `1af51d5f1b640f3e2484a9bd8e3773dabde8f4fc80f71b2c648d291407dcfe58`.
- OpenSpec synchronized the new requirements into `spec-workspace` and `clinic-interface`, then archived the change as `2026-10-18-existing-project-baseline`. Strict validation passed for all **ten accepted capabilities** and the `clinic-sdd` schema; no active changes remain. The final archive checklist item was completed after successful archival.

The working tree still has no initial commit, so this is local implementation and fixture evidence without an isolated self-implementation branch or verified target-branch integration. Live Codex/Claude semantic completeness, independent live-agent QA, external services and execution of other agents remain unverified. Provider-free setup explicitly installs guidance only; it does not generate source-derived specs. Binary documents and other excluded paths are disclosed rather than claimed as analyzed.

## Prompt/document setup and durable clarification (2026-10-18)

The approved prompt-project-clarification proposal, research, design, ten acceptance scenarios and validation plan were recorded and strictly validated before implementation. New projects accept a prompt, local product documents and visual references, retain their drafts and decisions, and present the complete SDD package for review before Apply. Developer clarification checkpoints persist their originating stage and revision context, preserve partial implementation, and require reviewed specifications again when an answer changes intent.

- Final pnpm check passed typecheck, **117 unit/integration tests**, strict validation of all **11 active specs/changes**, and the production build. **Two opt-in live-provider tests were skipped.**
- Final pnpm test:e2e passed all **eight browser workflows** in 24.9 seconds, including existing-project analysis and new prompt/attachment setup, clarification, reload recovery, reviewed application and mobile layout.
- Ten setup-draft fixture cases cover prompt/attachment combinations, real PDF and DOCX text extraction, PNG and JPEG image inputs, unsupported/unreadable sources, scanned PDFs, upload limits, complete chunk acknowledgements, malformed specs, conflicts and multiple question rounds, offline/restart recovery, cancellation, stale answers/files/attachments, custom guidance and overlapping specifications. A destination created after review is rejected; explicit regeneration analyzes that directory and preserves its owner files. Assertions verify no destination writes before Apply.
- Seven clarification fixture cases exercise analysis, specification authoring, implementation and QA, same-workflow continuation, answered decision history, changed intent and renewed approval, stale revisions and cancellation of durable waiting runs. Partial code survives interruption. Existing workflow/delivery fixtures verify clear requests and distinguish QA failures from unresolved intent. Two additional engine fixtures verify native Codex/Claude image protocol delivery.
- Canonical skills and five native instruction targets include the clarification contract. Clinic's own adoption used normal proposal/application machinery with a disposable Store: four canonical skills and five instruction files were upgraded while preserving customized surrounding content; repeated setup proposed zero files. The change also passed native schema/scenario coverage approval in that disposable Store (pre-archive context hash: 8012726cb7a019cbc897a79aef6c0b7fc812f0829a14d3923084890404c3b955).
- Docker Compose rebuilt and restarted successfully. Actual Linux-container PDF and DOCX extraction passed. The served application returned HTTP 200; desktop (1440px) and mobile (375px) setup forms passed browser checks without page errors or horizontal overflow. Screenshots under ignored test-results/docker-product-setup-*.png were visually inspected. This walkthrough did not create project files or invoke a provider. Final application image manifest list: sha256:a842cf7f9e4f44f7bf4503594417762d744aa9c3fd48a7856022e9557824af5e.
- Source/test digest: **60 files**, sorted relative paths + NUL + bytes + NUL under src/ and tests/; SHA256 4a6eb9e812dca61d37706db74deab0214843677ef1efdaab74a870f3244cdd24. Pre-archive specification delta digest using the same algorithm: **two files**, SHA256 4965a9a3788144b15ea5f96038ad4abfb29631a20a4da63030c33b17b6e3a595.

PDF/DOCX ingestion extracts text; embedded illustrations/layout require separate image attachments. Scanned PDF pages without text require replacement text or images and are reported explicitly. Live Codex/Claude semantic quality, independent live-agent QA, external servers and execution by other agent tools remain unverified. Fixtures demonstrate workflow/protocol behavior, not live model comprehension. The repository has no initial commit; this records local verification without claiming isolated self-implementation or target-branch integration. No Git repository initialization, commit, merge or publication was performed.

OpenSpec synchronized both requirements and archived the change as `2026-10-18-prompt-project-clarification`. Post-archive strict validation passed for all ten accepted capabilities and the `clinic-sdd` schema; no active changes remain. The final archive checklist item was completed after successful archival.

## 2026-10-19: Baseline validation companions

Owner requested validation beside spec.md; implemented deterministic scenario-mapped validation.md for every newly generated baseline capability, initial and deep. All checks start UNVERIFIED; no application tests are executed by setup and no reconstruction equivalence is claimed. Existing companion conflicts fail before writes. Baseline-only limit increased to 200 files for 60 capability pairs plus guidance.

Validation: pnpm check passed (150 tests, 2 opt-in live tests skipped; 11 strict OpenSpec items; typecheck/build). pnpm test:e2e passed 8 tests. Independent read-only QA passed 40 focused tests with no remaining blockers. Actual Docker CLI image smoke applied both native documents to a disposable host-mounted project using a fixture provider and one synthesis request. Live provider semantics, exact reconstruction, and Git integration remain unverified. Existing accepted specs are preserved, not retroactively rewritten.

Exact SHA256 revisions:
- `src/server/setup-analysis.ts`: `5169ce89ab00770d389f73848254c82147f7d79fa8a510b672a88ca81390657c`
- `src/server/specs.ts`: `d662b18a460542ca3d93e8dc2d2b8785010efd2ebe45018bae3279c7331cd63e`
- `tests/setup-analysis.test.ts`: `d8014ff5f5f61995cc893e51699db6b1b2fdd3555d8db69d82bbec823bce17c4`
- `tests/setup-overview.test.ts`: `19ae80d6616e32086494253646de7760c9d748886c78a1303e55d8e029ed59c8`
- `openspec/changes/global-cli-project-setup/specs/spec-workspace/spec.md`: `4c54b81e7e1207de2261967900206df7a9b7f9a62ca3db4da46ab4d7b1e3dcb9`

Installed packed global CLI at `/home/developer/.local/share/sddclinic/0.1.0-584736f4519e`; host command help verified. Updated runtime image without restarting the GUI or an existing setup run.

## 2026-10-19: Reconstruction-oriented terminal setup

Owner clarification: specifications should support rebuilding from an empty codebase. Added --rebuild to the host/container CLI, comprehensive eligible-source evidence collection and an additional structured reconstruction synthesis. Eight required areas carry captured/unknown/not-applicable status, source references, technical contracts and gaps. Rendered openspec/project/reconstruction.md includes capability links and a clean-room comparison procedure; unknowns remain blockers and all equivalence is UNVERIFIED. Preserve custom guides, original code and existing accepted specifications. Quick initial setup remains available unchanged.

Verification: pnpm check passed (154 tests, 2 opt-in live checks skipped; 11 strict OpenSpec items; typecheck/build). pnpm test:e2e: 8 passed. Independent read-only QA: 28 targeted tests passed, no blockers. Docker fixture smoke generated native spec, validation and reconstruction guide in a disposable host-mounted repository and preserved source. No live inference, clean-room implementation, runtime comparison, semantic completeness or exact reconstruction equivalence has been verified. Git integration remains unverified.

SHA256 revisions:
- `src/server/reconstruction.ts`: `8a7090e5c56f8872031a5c452290ade69b2c5965834e079ae4e71efe0a11ecac`
- `src/server/setup-analysis.ts`: `86e18079975dd942d3578bb18de302a785c71af355f7ef49518082db10b3b396`
- `src/server/specs.ts`: `d73872f6f53687ffbceb8b5225cc2ff12c7bc9700ba1791663980cb0cba9a900`
- `src/server/terminal-setup.ts`: `81bffb1f2719405412183443cd02d7e4646c0a3127213f8c30dbedf5799a68bd`
- `src/server/cli.ts`: `c80c899ce5489a2bb3a49eb4ad8345338b26ed6d914024daca2b478de422b7e9`
- `bin/sddclinic.mjs`: `fa17c824c9f630117d26615d5865655edbe8bd937aa2aaf2fae9d173e3dba5b8`
- `tests/reconstruction.test.ts`: `339ec3313be617045080768ceb5f31a874a3fd65a990e2090586323d17aa453c`
- `openspec/changes/global-cli-project-setup/specs/spec-workspace/spec.md`: `d8cbb6fd2cf6a1fc47f8d17f5ab27fb01c2064deb8920ef92dc7cd7e8f00ad84`

Packed global CLI installed at `/home/developer/.local/share/sddclinic/0.1.0-87485279f555`; installed help confirms --rebuild. CLI Docker image refreshed without restarting existing project runs or GUI.

## 2026-10-19: Native dependency and Docker ignore inventory correction

User reconstruction setup scanned ios/Pods Boost headers until the20MB cap. Built-in native dependency/cache exclusions now prune Pods, DerivedData, .gradle, .cxx, .expo, .dart_tool and .build at any depth before descendant traversal. Native sources/manifests remain evidence. Actual Docker verification exposed a second problem: Git rejected mounted-repository ownership and inventory lost ignore rules, scanning artifacts/web exports. Read-only git ls-files now uses a command-scoped safe.directory for the selected project; no persistent/global configuration changes.

Final pnpm check:157 passed,2 opt-in live tests skipped; strict OpenSpec11passed; typecheck/build passed. pnpm test:e2e:8passed. Independent QA passed inventory regressions including different-owner Git handling. Real example-app inventory succeeds both on host and through a read-only Docker mount:231files,1,324,668 eligible text bytes, Pods and exported artifacts excluded. No user-project writes or provider inference performed. Earlier Docker attempts failed first on ignored export content; final result is after the scoped Git fix. A test harness initially lost the Git test environment through cleanEnv; corrected to inject it only into fixture command execution, then full checks rerun.

Revision hashes:
- `src/server/project-inventory.ts` SHA256 `419718c275c32cff93453ce14be762e55c7602d24445b11965ea88f3de2c45ee`
- `tests/project-inventory.test.ts` SHA256 `c53edd79e16095ecc8b42b3a12d9a89d29123a419a95c603073925eaa42778a7`

Installed packed global CLI at `/home/developer/.local/share/sddclinic/0.1.0-e15a3f879d52`; installed command help passes. No running GUI or setup process restarted.

## 2026-10-19: Public distribution preparation

Owner explicitly authorized public GitHub source, npm and Docker Hub publication and selected MIT. Public targets: Hayko97/sdd-clinic, npm sdd-clinic, Docker Hub sintyoa/sdd-clinic. Private machine/project identifiers in historical operational notes were sanitized after saving local private originals. Source credential-pattern scan found only two intentionally nonfunctional private-key test fixtures, inspected as literal test data. No credentials or runtime databases are included.

Current pnpm check:162 tests passed,2 opt-in live tests skipped;12 strict OpenSpec items; typecheck/build passed. pnpm test:e2e:8passed. Independent QA:6 launcher cases and12 provider/install checks passed after resolving cold Claude preparation timeout with a public-image-only180-second bound. Public tarball inspected:166 entries, MIT, CLI and GUI assets, no host dependencies/lifecycle scripts, full runtime dependency manifest retained. Installed exact tarball into an isolated npm prefix and verified command help. Multi-platform image, registry publication and actual public-image GUI verification are pending at this preparation revision.

Public npm artifact SHA256: `e2933a8f8201c4eab40bdb547d3bbe9b69bd8b35a3809c3bff736b8d0b1a0010`.


Public distribution follow-up: the exact packaged image starts the authenticated GUI successfully; Linux amd64 Codex version and Linux arm64 cold Claude installation/version checks passed without model inference. Both image platforms built successfully. The first GitHub Linux CI run exposed inherited Git configuration in the ownership fixture; the fixture now disables system/global Git configuration while preserving command-scoped trust. Independent QA reran all three inventory cases successfully. Required local checks again passed (162 tests; two live checks skipped). Registry publication and final Linux CI remain pending at this revision.


Release packaging corrections: explicit `./releases/` npm archive paths prevent GitHub shorthand interpretation, and COPYFILE_DISABLE omits macOS metadata during repacking. Independent review found no blockers. Final pnpm check again passed (162 tests; two opt-in live tests skipped; 12 strict OpenSpec items; build/typecheck), followed by eight passing browser tests. Clean tarball contains83 entries and no AppleDouble metadata, application dependencies or lifecycle scripts in the host manifest; installation into an isolated npm prefix passed. SHA256: `733c5a65a3693b942aead9661aa4d644a39a60a17b2a7715f1be77206d779a77`. GitHub Linux CI passed at c4cc8d4; these packaging-only corrections have local validation. npm initially rejected the account without2FA; the owner enabled2FA and browser publication authorization is pending. Docker upload is in progress.


## 2026-10-19: Public release0.1.0 verified

Tagged source: `d1ccdd3` (`v0.1.0`), MIT. [GitHub release](https://github.com/Hayko97/sdd-clinic/releases/tag/v0.1.0) includes the exact tarball and SHA256SUMS. [Linux CI](https://github.com/Hayko97/sdd-clinic/actions/runs/39313928509) passed checks, browser acceptance and packaging at that revision. All five public-distribution task groups are verified; this record supersedes the pending publication states above.

[npm sdd-clinic0.1.0](https://www.npmjs.com/package/sdd-clinic) is public and latest. Owner enabled2FA and completed browser authorization; npm subsequently processed the upload. Anonymous registry read and tarball download succeeded. Downloaded SHA256 matches the tested clean archive: `733c5a65a3693b942aead9661aa4d644a39a60a17b2a7715f1be77206d779a77`. Fresh-prefix npm installation from both GitHub release URL and public registry succeeded; installed help works.

[Docker Hub](https://hub.docker.com/r/sintyoa/sdd-clinic) publishes0.1.0 and latest with linux/amd64 and linux/arm64. Anonymous registry manifest retrieval confirmed digest `sha256:b5d34ec66f5c67bb1cfeaeba1124c211bbefbc591fdf9131c85615248fd77c5f`. The installed release CLI pulled that image, started a disposable isolated GUI, and passed a real Playwright authenticated Projects-screen check with no browser errors. Persisted image selection matched0.1.0. Test container/volume cleaned; existing user GUI/setup processes were preserved.

Provider version/cold-install smoke evidence is separate from model inference. Live inference, clean-room project reconstruction equivalence and future workflow publishing credentials remain unverified/unconfigured. Manual initial publication succeeded; future GitHub publishing still requires the documented Docker Hub secrets and npm trusted-publisher configuration.


## 2026-10-20: Documentation repair patch preparation

Owner approved revised global-cli-project-setup companion/repair/changelog requirements and patch0.1.1 publication. Shared setup completion now fills missing native validation companions from existing/generated scenario text, including GUI prompt/document setup, and creates a missing root changelog. Repair skips provider work and application-source inventory; existing custom specs/validation/changelog casing remain preserved. Each generated check is UNVERIFIED. Native change templates supply future proposal/research/design/tasks rather than fabricated implementation records.

Independent QA found and then verified a generation-to-proposal race correction: retain original context hashes and explicit null creation hashes; protect all setup callers and profile reproposals. Independent rerun36 tests passed with no blockers. Targeted source/baseline/product/repair suite41passed, including before-review mutations. Earlier full pass172tests plus2live skips and8browser tests preceded the race fix; final full release checks and Docker/publication evidence follow separately. No live inference or reconstruction equivalence is claimed.

Final corrected source checks: pnpm check passed174 unit/integration tests with2 opt-in live checks skipped,12 strict OpenSpec items, typecheck and production build; pnpm test:e2e passed8browser tests. The original snapshot race is covered by targeted regressions and independently cleared. The idle local source GUI was rebuilt and refreshed; a real authenticated Playwright Projects-screen smoke passed at application version0.1.1. Public package/image and actual container repair checks remain pending at this source commit.
