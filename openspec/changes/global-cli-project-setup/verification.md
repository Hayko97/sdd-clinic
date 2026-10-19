# Global CLI setup verification

Verified locally on 2026-10-19. Implementation is installed and usable; Git integration, owner review and archive remain separate workflow steps. This repository has no HEAD commit, so no merge or commit was fabricated and existing untracked work was retained.

## Revision evidence

- Observable delta specifications SHA-256: `f9f65e607a08378c95d810799aaf66e9e81aef5a2577fdb2f18151cd777bb2d7` (sorted `specs/**/*.md`, path + NUL + content + NUL).
- Implementation/test/runtime SHA-256: `257b737b420c2e639b4441b7cfd7e577742285eae607caf72e3d3ca577ceb5e2` (75 files under `bin`, `runtime`, `scripts`, `src`, `tests`, plus package.json, pnpm-lock.yaml, pnpm-workspace.yaml, Dockerfile.cli and Dockerfile.cli.dockerignore; same encoding).
- Independent QA snapshot: `cedd24e9f447542061ec46e8c1909c16009c07569d12d41f8ce60aa478bd4a12`; reviewer included change documents in its 85-file snapshot. Later changes only update verification/task documentation.
- Installed packed artifact: `~/.local/share/sddclinic/0.1.0-9b61492b48e1`. Both aliases resolve in a fresh zsh session. The install adds the managed ~/.local/bin entry to ~/.zshrc.

## Automated checks

- `pnpm check`: passed TypeScript, 133 tests across 20 files, strict OpenSpec validation (11 items), and production build. Two opt-in live tests skipped.
- `pnpm test:e2e`: 8 passed in 22.5 seconds on the final sequential run.
- A concurrent run initially passed 7/8: the last browser reload received 404 while another build replaced dist/web. Rerunning after the build completed passed all eight. Run build/check and production-asset browser tests sequentially.
- Independent read-only QA: no blocking findings; 24 focused tests passed across terminal setup, launcher lifecycle, and provider protocols.

## Acceptance coverage

| Behavior | Observed evidence |
| --- | --- |
| Global installation, aliases, external working directory, spaces in paths | Packed artifact installed and invoked outside the checkout; real PTY setup applied 33 guidance files. Fresh zsh resolves both aliases; alias doctor succeeded. |
| Missing runtime prerequisites | Installed doctor with PATH=/nonexistent exited 2 with actionable Docker installation/start guidance before application writes. |
| Existing intent, full analysis, model and reasoning selection | Terminal fixtures inventory source/SDD assets, preserve custom agents and unknown configuration keys, exercise analysis/consolidation/synthesis, enforce explicit model/effort, reject unsupported pairs and incomplete output. |
| Medium default and profile scope | Tests show saved extra-high is not inherited; every provider request gets the selected pair, and only setup configuration changes. Actual packaged Codex protocol schema and Claude help expose the required effort controls. |
| Authentication and no-inference mode | Fixtures reject missing authentication; real Docker guidance-only setup runs unsigned. Actual doctor finds Codex 0.163.0 and Claude 2.1.302 installed and compatible but unsigned. |
| Review, stale evidence, cancellation and no TTY | Tests reject changed sources and noninteractive setup. Real PTY decline and Ctrl-C write no setup files and no GUI registration; Ctrl-C returns 130. |
| Repeat setup and project naming | Real setup reports no required changes on repeat and retains one canonical registration. GUI uses the host directory name, not the container mount name. |
| Global GUI visibility and repository access | Actual Chromium opens the CLI-configured project; authenticated API returns its agents and skills; Developer workspace opens. |
| Add another external project | A second project is set up and mounted into the already running disposable global GUI; both registrations and mounts survive recreation. |
| Busy GUI and retry | Fixture proves active work leaves registration pending without recreation; retry registers once. Transactional maintenance test rejects new agent runs during a mount update and allows them after release. Actual-mount drift is checked independently of saved configuration. |
| Preserve existing global GUI | Updated the idle local source GUI with its named volume retained. The original SDD Clinic project retains ID 0eac119f-96aa-4d97-8ae9-932c0918509e and /projects path; global start returns a ready authenticated launch URL. |

Real smoke evidence, including PTY logs and GUI screenshot, is in `<local-temporary-smoke-directory>`. Disposable GUI containers/volumes were removed afterward. Local command logs: `/tmp/sddclinic-final-check.log`, `/tmp/sddclinic-final-e2e-sequential.log`, `/tmp/sddclinic-global-install.log`, `/tmp/sddclinic-installed-doctor.log`. These temporary files are local diagnostic evidence, not permanent release artifacts.

## Limits and remaining review

No live provider inference, model-quality comparison, external MCP/SSH server, public package publication, Git merge or deployment was performed. Model behavior is covered by fixtures; availability is checked against the provider during actual setup. User must sign in when prompted for full analysis. GPT-6.1 Sol medium is a researched recommendation, not an experimentally proven optimum. macOS Docker smoke does not establish Windows/Linux installation acceptance.

Owner review and archival/integration task 4.3 remains open. Proposed roadmap update after review: describe global terminal setup with automatic GUI registration as locally verified; keep public distribution and live-provider benchmarking separate.

## Browser authentication correction — 2026-10-19

Supersedes the earlier terminal-login behavior and QA for missing authentication. Owner requested automatic browser opening after device-code login was rejected by account settings. Specifications refined and validated before implementation; the owner’s explicit correction authorizes the changed behavior.

- Normal Codex login replaces forced --device-auth. Setup automatically starts provider sign-in when needed, forwards the browser callback through Docker, and re-probes before analysis. Already-authenticated and guidance-only runs skip sign-in. Host credentials are not copied and account settings are not changed.
- Final `pnpm check`: 139 tests passed; 2 opt-in live tests skipped; TypeScript, strict specifications and build passed. `pnpm test:e2e`: all 8 passed (21.5 seconds), run after the implementation build. A subsequent test-only change added successful Claude coverage and made cancellation-fixture startup waiting/cleanup robust under load; final check includes it.
- `tests/terminal-login.test.ts`: validates provider URLs/redirects, split output chunks, browser launch fallback, callback-port conflicts, actual loopback HTTP forwarding, invocation nonce isolation, cancellation cleanup, normal Codex arguments, and successful Claude auth-login/end events. Terminal setup tests verify automatic login, re-probe and skip paths.
- Independent QA found no blockers. It ran the focused correction tests and re-ran final terminal-login tests (5/5); application code hashes stayed unchanged. QA test SHA-256: 8b5c8237f7238581a1485397230d0f3a1e7a96469723db38eff316826c8b4cfe.
- Real Docker smoke passed: installed host bridge opens a test browser handler, which calls host localhost:1455; traffic crosses Docker's random loopback publication to container relay1456 and reaches a fake provider listener1455. Login succeeds and listeners close. This test uses no real account approval or inference.
- Packaged real Codex 0.163.0 normal login emitted its browser authorization challenge and initialized its callback relay. It was canceled before opening the account page. This verifies protocol startup, not successful account authentication.
- Reinstalled both global aliases in ~/.local/bin from packed artifact ~/.local/share/sddclinic/0.1.0-806e08d845e2; fresh zsh resolves sddclinic. Updated installation guide explains automatic browser login and port-conflict/manual-open recovery.
- Revision SHA-256: 3765b75822e73628771a8a73c4be330abd08f2d25c075b2a561a17d034b8b14e over sorted paths plus NUL plus contents plus NUL: bin/sddclinic.mjs, bin/setup-browser.mjs, runtime/browser-auth.mjs, src/server/cli.ts, src/server/terminal-login.ts, src/server/terminal-setup.ts, tests/terminal-login.test.ts, tests/terminal-setup.test.ts.
- Logs: /tmp/clinic-browser-auth-final-check.log, /tmp/clinic-browser-e2e.log, /tmp/clinic-browser-auth-install.log. Reproducible local Docker smoke harness: /tmp/clinic-browser-docker-smoke.mjs. Temporary smoke containers were removed. No account approval, live model inference, public publishing, Git integration or GUI device-login change is claimed.

A prior additional focused test run hit the default one-second startup polling timeout under concurrent load. Its cleanup was corrected to always abort/await the provider process, and polling now allows four seconds. The final full check and independent focused rerun both pass.

## Specification-generation correction — 2026-10-19

The owner reports missing specifications after setup. Read-only runtime evidence establishes that example-app's previous run failed on an out-of-batch .compnots/PO.md reference. Its next run subsequently failed on an out-of-batch src/admin/AdminPanel.tsx reference after completing 6 of 26 batches. Neither reached successful synthesis/application. These are user-initiated live-run observations, not agent-run provider acceptance tests. No user repository files or active processes were changed during investigation.

This correction preserves native OpenSpec creation and strict citation validation, adds at most two correction attempts for invalid returned output using original evidence/model/effort, reports batch starts and elapsed provider waiting, and refuses full terminal success without new or existing native capability specs. Explicit guidance-only retains its separate behavior. Synthesis citations must be contained within the findings supplied to that stage; independent QA identified this gap and verified its fix. Provider/network errors and cancellations are not silently retried.

Verification:
- Final pnpm check: TypeScript, 145 tests across 21 passing files, strict OpenSpec validation and build passed; two opt-in live tests skipped.
- pnpm test:e2e, after the build: all 8 passed.
- Independent read-only QA: no remaining blockers; 35 focused terminal/shared-analysis tests passed. Code SHA-256: setup-analysis.ts e5b947ac24aba357cd7df0ce1ab4fa97b1e6fc5fe8331aceb2ad2520f8c9a107; terminal-setup.ts d1afd7ae1bd3a1c261b9f7b9987b1966937cf97f3fb0e299839066e6107c2cec.
- Full terminal regression uses nested packages/shop/catalog.ts; asserts review occurs before writes and the resulting openspec/specs/catalog/spec.md has meaningful purpose, SHALL requirements, WHEN/THEN scenarios and source references.
- Repair fixtures cover out-of-batch citations, synthesis citations to inventory lines absent from supplied findings, invalid output exhaustion, unchanged model/effort, and no scaffolding writes after incomplete output. Existing shared tests cover malformed JSON, missing chunks, repeated setup and stale sources. Fake-time test verifies 10-second waiting feedback and heartbeat cleanup.
- Real Docker smoke runs compiled terminalSetup with a controlled provider fixture, injects an invalid citation, validates its correction, applies the reviewed baseline, and reads the actual host-mounted openspec/specs/catalog/spec.md. Purpose, requirement, scenario and source reference are verified. Temporary test project was removed.
- No new live model inference, account operation, Git integration, publication or archive was performed. The repaired live example-app run still requires rerunning setup and approving its proposal; fixture success is not proof that its full live output will be semantically complete.

Local logs: /tmp/clinic-spec-generation-final-check.log, /tmp/clinic-spec-generation-e2e.log, /tmp/clinic-spec-generation-final-focused.log. Docker harness: /tmp/clinic-spec-docker-smoke.mjs. The installation guide now distinguishes full specification setup, analysis/review stages and explicit guidance-only behavior.

Final correction delta-spec SHA-256: 721bc45c101c56ac193a91f91825b204a333e07d1d5fd7db7a44b8be49f1f41d (sorted relative paths + NUL + contents + NUL). Installed packed artifact: ~/.local/share/sddclinic/0.1.0-9f721eaaa8ba; both global aliases updated, fresh zsh resolves the launcher. Task7 verification complete; owner review/archive/integration task4.3 remains separate.

## Initial specification setup as default — 2026-10-19

Owner explicitly requested initial SDD setup without exhaustive analysis, and confirmed openspec/specs/ as the destination. Terminal default now selects bounded project context and goes directly to specification synthesis; --deep retains prior exhaustive batches. The existing GUI baseline audit retains its previous behavior. Initial coverage is explicitly limited and existing current/pending specifications are mandatory context; oversized intent asks for --deep instead of dropping it.

- pnpm check passed:148 tests, TypeScript, strict OpenSpec validation and production build;2 opt-in live tests skipped.
- pnpm test:e2e after the build:8 passed.
- Independent QA:41 focused tests passed; no blocking findings. Default fixture produced a real catalog/spec.md via one inference call, context limits and dependency exclusions passed, and deep regressions remain covered.
- Real Docker smoke using compiled terminalSetup and a controlled provider produced a host-mounted openspec/specs/catalog/spec.md in exactly one synthesis call, with no analyze/consolidate calls. Verified purpose, requirements, scenarios and source references. This is fixture inference, not live model validation.
- Read-only example-app overview selection:193 eligible files locally inventoried,13 files selected,36,000 source characters. No model request or project write occurred during this inspection. node_modules and generated/dependency directories stay excluded in both modes.
- Terminal identifies initial/deep/guidance-only mode and shows spec diffs first. No writes occur before approval. An already-running old command retains its previous behavior and must be canceled/restarted by its user to use this version.
- Revision SHA-256: 675d9112a923fc9c090486f41718bfc4f0131df8b6b91661aeadf7bb3a9b5d01 over sorted path + NUL + contents + NUL for bin/sddclinic.mjs, src/server/cli.ts, src/server/setup-analysis.ts, src/server/setup-overview.ts, src/server/terminal-setup.ts, tests/cli-launcher.test.ts, tests/setup-overview.test.ts, tests/terminal-setup.test.ts.
- Logs: /tmp/clinic-initial-setup-check.log, /tmp/clinic-initial-e2e.log, /tmp/clinic-initial-spec-tests.log. Docker harness: /tmp/clinic-initial-spec-docker-smoke.mjs. No live inference, user-run interruption, publishing, Git integration or archive performed.

README and installation guide distinguish initial generation, explicit --deep and guidance-only. Existing task4.3 owner review/integration remains separate.

Installed global packed artifact: ~/.local/share/sddclinic/0.1.0-9515bb3e8445. Fresh zsh help confirms initial specification default and explicit --deep. Installation log: /tmp/clinic-initial-install.log.

## 2026-10-20: Setup evidence-quality correction

Implemented in isolated branch `codex/setup-evidence-quality`, based on `3d12f4f321f8340e577d8a72adec595a280957e2`, using the owner-approved kpcru audit handoff. Full evidence and all 36 finding dispositions: `artifacts/setup-quality-2026-10-20/REPORT.md`; exact source/spec SHA256 values: `verification.json` in that directory.

- `pnpm check`: passed; 199 tests passed, 2 opt-in live tests skipped; typecheck, 12 strict OpenSpec validation items, and production build passed.
- Final `pnpm typecheck` and `pnpm test:e2e`: passed; all 8 browser tests passed. The browser guidance assertion now checks the newly required named documents rather than the obsolete five-button count.
- Actual isolated Docker Compose/browser smoke: passed review/apply, no early writes, source preservation, concrete validation, architecture guidance, mobile viewport and reuse-only quality review without replacing accepted specs/companions. Scripted provider protocol, not live inference.
- Read-only kpcru source-manifest selection: 48/131 source files and 35,999 characters, with omitted ranges recorded; no generated client specs or application files changed.
- `git diff --check`: passed. The current agent reviewed the diff. No separate independent QA, target-branch integration, global installation, publication or deployment is claimed. The active change remains unarchived.

Live semantic completeness, exact application reconstruction and customer cancellation implementation remain unverified. Source hashes identify inspected bytes, not committed customer code. See the report for limitations and preserved custom-document behavior.
