# Validation plan

## Scenario coverage
The table below records the planned checks. Actual implementation and verification outcomes are recorded separately in `verification.md`.

| Scenario | Check / procedure | Expected evidence |
| --- | --- | --- |
| Run setup after global installation | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | The command is available, targets that project and uses the packaged Docker runtime without requiring the Clinic source working directory |
| Retain existing CLI usage | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | The existing supported interface remains available |
| Report unavailable runtime prerequisites | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | It exits with an actionable diagnostic before provider analysis or project writes |
| Preserve an existing browser mount | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | The browser runtime mount and registrations remain unchanged and terminal runtime state separation is explained |
| Analyze project assets before setup | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | It inventories eligible source, documentation, accepted specs, active changes, project context, agent definitions and skills and reports reuse, gaps, conflicts, coverage and exclusions before presenting the complete proposed diff |
| Apply a reviewed terminal proposal | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | Clinic validates and applies it through existing setup protections, preserves custom files and reports written paths without implementing product code or performing Git integration |
| Repeat terminal setup | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | Existing specs and customized agents, instructions and skills are preserved and no duplicate managed setup is created |
| Reject changed terminal setup evidence | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | The whole proposal is rejected without partial setup writes and the command requests reanalysis |
| Handle missing provider authentication | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | Setup explains how to authenticate in its runtime and does not claim analysis occurred or silently switch provider or mode |
| Choose guidance only in the terminal | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | Setup reviews local guidance additions without inference and clearly reports code-derived analysis was not performed |
| Decline or interrupt terminal setup | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | No setup proposal is applied and the terminal reports the outcome |
| Fail incomplete terminal analysis | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | Setup reports the failure and does not offer the incomplete result as a complete applicable baseline |
| Reject noninteractive setup | CLI process fixture exercising this trigger; assert outcome and project/runtime snapshots | It exits before analysis or mutation with instructions for interactive review rather than treating absent input as consent |

| Choose the setup model before analysis | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | The terminal offers a setup-specific model selection, recommends an available suitable model with medium reasoning, and displays the selected pair before inference |
| Override setup model and reasoning | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | That pair is shown and used for every analysis, consolidation and synthesis request and recorded in run evidence |
| Do not inherit extra-high setup reasoning | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | Setup defaults to medium and does not escalate effort without explicit user selection |
| Handle an unsupported setup model pair | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | Setup reports the limitation before analysis when discoverable and otherwise fails visibly on provider rejection without silently changing the pair |
| Save a reviewed setup profile | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | The setup-specific profile is saved while existing agent model settings and unrelated configuration are preserved |
| Skip model setup for guidance only | Terminal/provider protocol fixture; assert prompt selection, request parameters, run evidence and configuration diff | No provider model discovery or inference is required and inference-only flags are rejected as incompatible |

| Open a terminal-configured project in the GUI | Host registration fixtures plus packaged Docker/browser smoke; inspect persisted records, mounts and project workspace | Required registration outcome is observed without lost mounts, duplicate projects or interrupted work |
| Set up the same project again | Host registration fixtures plus packaged Docker/browser smoke; inspect persisted records, mounts and project workspace | Required registration outcome is observed without lost mounts, duplicate projects or interrupted work |
| Add a project outside current GUI mounts | Host registration fixtures plus packaged Docker/browser smoke; inspect persisted records, mounts and project workspace | Required registration outcome is observed without lost mounts, duplicate projects or interrupted work |
| GUI registration cannot finish safely | Host registration fixtures plus packaged Docker/browser smoke; inspect persisted records, mounts and project workspace | Required registration outcome is observed without lost mounts, duplicate projects or interrupted work |
| Do not register declined setup | Host registration fixtures plus packaged Docker/browser smoke; inspect persisted records, mounts and project workspace | Required registration outcome is observed without lost mounts, duplicate projects or interrupted work |

## Environments and limits
Use disposable repositories, scripted provider adapters, controlled terminal input, isolated installation prefix and disposable Docker state. Packaging checks must pack/install the actual artifact and invoke both binaries outside the source checkout, including a target path with spaces. Compare before/after file hashes for preservation and rejection cases. Check browser runtime mount identity before and after concurrent terminal setup. Use real Docker for launcher smoke coverage; report unavailable Docker as unverified. Full live-provider inference and external services are opt-in and separate from fixtures.

## Acceptance and evidence
Run pnpm check and pnpm test:e2e plus the scenario-specific terminal and packaging checks. Record actual revision-linked outcomes separately from this plan. Independent QA, review and manual integration follow project workflow; no implementation criteria may be marked verified from specification validation alone.

Model quality comparison is opt-in: compare Sol medium, Luna medium and Sol high on representative repositories where available; record coverage, correctness, latency and usage separately. No live evaluation has established an optimal model. Adapter fixtures must prove explicit effort is sent on every setup stage, including with global xhigh configuration, and no model settings leak into unrelated agents.

## Browser authentication correction checks
Handle missing provider authentication and Browser sign-in without device-code access: fake login subprocess must receive normal login arguments, open a validated browser URL and forward an actual loopback HTTP callback; re-probe authentication before inference. Browser launch or callback fails: inject opener failure and occupied port, assert manual link/actionable error with no false success. Cancel browser sign-in: abort a waiting subprocess, assert relay closure and no writes. Reuse authenticated setup runtime: fixtures assert no login invocation; guidance-only smoke still works. Verify nonce and URL rejection, split output chunks, and cleanup. Run a real Docker callback-forwarding smoke with a fake provider and no real account approval/inference. Run pnpm check then pnpm test:e2e sequentially before reinstalling the packed CLI.

## Specification-generation correction
Repair invalid analysis evidence: fixture first returns out-of-batch citations or malformed JSON then correct output; assert bounded attempts, unchanged model/effort and strict acceptance. Exhaustion must produce no proposal/writes. Show progress during specification generation: assert batch start/counts, waiting updates and spec paths. Do not report specification setup without specifications: terminal zero-spec fixture must fail without scaffolding writes; guidance-only still works and existing real specs remain preserved. Create the project specification baseline: run full terminal flow using realistic nested feature evidence, confirm review and actual spec files with purpose/requirements/scenarios/references; verify rejection/stale sources still write nothing. Run full checks and browser tests sequentially, independent QA, package/install updated CLI. Read-only active user-run status is not test evidence of generation or approval.

## Initial default setup
Start specification-driven development without a full audit: large fixture produces native specs using one synthesis request with bounded context, no analyze/consolidate requests, no dependency content, and an explicitly sampled report. Request exhaustive baseline analysis: --deep preserves existing batch/repair tests. Existing intent exceeds initial context bounds: oversized native specs fail with --deep instructions before inference or writes. Verify flag incompatibility and package installation; run pnpm check and pnpm test:e2e sequentially plus independent QA.

## Companion acceptance checks
- Generate scenario validation plans: initial and deep fixtures assert every scenario maps to conditions, expected observations, source and unverified evidence; initial remains one inference call.
- Preserve existing validation and application code: snapshot source before/after; existing companion collision rejects without overwrite.
- Distinguish baseline from reconstruction evidence: assert companion explicitly disclaims reconstruction evidence and requires actual execution; run strict OpenSpec and full checks.

## Reconstruction checks
- Capture a reconstruction blueprint: controlled full terminal/provider fixture proves --rebuild sends comprehensive findings and writes native specs, companions and all eight guide sections; source unchanged.
- Reject incomplete reconstruction output: missing topic and outside-evidence citation fail parsing/validation; bounded repair/exhaustion integration fixture.
- Preserve reconstruction documents: customized guide causes failure without overwrites; managed guide uses existing inventory/stale protections.
- Report reconstruction readiness honestly: unknown/inapplicable reasons, excluded paths and unverified comparison plan survive rendering; no application execution.

## Native dependency inventory regression
Disclose excluded and unavailable content: fixture contains nested Pods and native build/cache directories whose files exceed tiny byte and entry limits. Inventory must skip whole subtrees, record exclusion reasons, and retain Swift/Kotlin source, Xcode project files, Podfile/Podfile.lock and Gradle configuration. Verify without Git and with tracked Pods. Dependency content changes must not change source fingerprint; authored-source edits must. Read-only real-project inventory is separate from live-provider inference.

Native regression also verifies ignored oversized exports under Git different-owner test mode and the actual Docker mount. No global Git configuration changes.
