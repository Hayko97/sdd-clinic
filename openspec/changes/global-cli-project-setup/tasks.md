# Tasks

## 1. Global launcher and runtime
- [x] 1.1 Package the sddclinic alias and Docker runtime assets; test Run setup after global installation and Retain existing CLI usage from a clean global prefix outside the checkout.
- [x] 1.2 Implement target resolution and runtime diagnostics; test Report unavailable runtime prerequisites and Preserve an existing browser mount, including paths with spaces.

## 2. Shared analysis and terminal review
- [x] 2.1 Inventory project assets and reuse baseline orchestration; test Analyze project assets before setup, Handle missing provider authentication, Choose guidance only in the terminal and Fail incomplete terminal analysis.
- [x] 2.2 Present full diff and require explicit confirmation; test Apply a reviewed terminal proposal, Repeat terminal setup and Reject changed terminal setup evidence using before/after snapshots.
- [x] 2.3 Handle refusal, SIGINT and absent terminal input; test Decline or interrupt terminal setup and Reject noninteractive setup.

## 3. Setup model configuration
- [x] 3.1 Add setup model selection and flags; test Choose the setup model before analysis, Override setup model and reasoning, and Handle an unsupported setup model pair.
- [x] 3.2 Validate packaged provider capabilities and forward explicit effort on every setup request; test Do not inherit extra-high setup reasoning with global and saved overrides, and capture protocol evidence for each stage.
- [x] 3.3 Propose a setup-only project profile and retain unrelated settings; test Save a reviewed setup profile and Skip model setup for guidance only, including rejected inference flags.

## 4. Documentation and verification
- [x] 4.1 Update installation guide and README with tested local global-install command, setup usage, runtime separation and diagrams; do not advertise a public release that has not been published.
- [x] 4.2 Run pnpm check, pnpm test:e2e, terminal fixtures and packaged Docker smoke checks; record exact outcomes and unverified live checks separately.
- [ ] 4.3 Obtain independent QA and owner review of implemented revision; synchronize/archive and verify integration only through the project workflow.

## 5. Global GUI registration
- [x] 5.1 Persist successful setup receipts and canonical host registration manifest; verify Do not register declined setup and Set up the same project again.
- [x] 5.2 Attach to the existing GUI or start the packaged global GUI, add precise project mounts and register via existing services; verify Open a terminal-configured project in the GUI and Add a project outside current GUI mounts with actual Docker and browser checks.
- [x] 5.3 Detect active work before runtime recreation and retain pending registrations; verify GUI registration cannot finish safely and retry through sddclinic start.

## 6. Automatic browser authentication correction
- [x] 6.1 Implement normal provider sign-in and automatic host browser launch with callback forwarding; test missing authentication and disabled device-code access.
- [x] 6.2 Test launch failure, callback conflict, chunked URLs, authenticated/guidance-only skipping, cancellation and cleanup.
- [x] 6.3 Run full checks sequentially, independent QA and real Docker relay smoke; reinstall global CLI and update guide/evidence.

## 7. Specification-generation correction
- [x] 7.1 Add bounded evidence/output repair and stage progress without weakening validation or changing model/effort.
- [x] 7.2 Require a real native baseline for full terminal success and report generated spec paths; test full terminal spec creation, empty output, repairs and preservation.
- [x] 7.3 Run full checks and independent QA, update documentation/evidence and reinstall without interrupting the user's active run.

## 8. Initial specification setup by default
- [x] 8.1 Add bounded overview selection and direct initial specification generation, preserving existing intent and reporting limited coverage.
- [x] 8.2 Expose --deep for exhaustive analysis; verify default creates actual specs without per-batch calls, with dependency exclusions and context limits.
- [x] 8.3 Run required checks, independent QA, update documentation and install the updated CLI.

## 9. Baseline validation companions
- [x] 9.1 Generate scenario-mapped validation companions, preserve collisions and source, and verify initial/deep behavior.
- [x] 9.2 Run full checks, independent QA, update documentation/evidence and reinstall global CLI.

## 10. Reconstruction-oriented setup
- [x] 10.1 Add --rebuild, detailed evidence synthesis and validated reconstruction guide with explicit gaps and source preservation.
- [x] 10.2 Test complete/incomplete/colliding reconstruction output, run required checks and independent QA, update docs and install.

## 11. Native dependency inventory correction
- [x] 11.1 Prune native dependency/cache directories and verify exclusion, limits, source/manifests and fingerprints.
- [x] 11.2 Run full checks, independent QA, Docker inventory smoke and reinstall the global command.

## 12. Complete documentation and repair (2026-10-20; owner approved implementation and patch release)
- [x] 12.1 Review and approve current companion/repair/changelog specification revision.
- [x] 12.2 Add shared companion generation and repair for existing specs; test complete mapping, unusable inputs, custom preservation and stale reads.
- [x] 12.3 Cover prompt/document setup and shared missing-kit/changelog generation; test new project, existing casing, decline and repeat behavior.
- [x] 12.4 Expose --repair through CLI/runtime with honest summary and GUI registration; verify no provider calls or application-source audit.
- [x] 12.5 Run required checks, independent QA and packaged Docker/CLI smoke. Record actual outcomes.
- [ ] 12.6 Publish patch0.1.1 and verify clean install, existing-project repair and documented new-project commands.
