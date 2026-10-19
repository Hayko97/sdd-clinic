# Research

## Existing intent and evidence
Observed 2026-10-19. `src/server/cli.ts` exposes start, doctor and help; `package.json` declares only the sdd-clinic binary. `compose.yaml` mounts a project root and persistent home; Docker is the required runtime. `src/server/app.ts` exposes reviewed setup using the existing projects, runs and proposal services.

Accepted spec-workspace requirements already cover reviewed setup, portable instructions, source baseline analysis, preservation and stale-source rejection. Project-skills covers canonical skills and Docker runtime. Local-runtime covers portable launch. Reuse these requirements; add only terminal entrypoint and installation behavior. No competing active change was present before this proposal. Historical baseline design is in ../archive/2026-10-18-existing-project-baseline/design.md.

## Decisions and sources
Repository code and accepted requirements are sufficient to define this extension; external model-selection research is recorded below for the revised scope. Public package availability is not assumed. Validate local package installation before documenting any distribution command. Provider protocols remain behind adapters and secrets behind the broker.

## Assumptions and open questions
Proposed defaults for owner review: current directory is the target; full analysis is the default; Docker remains required; explicit terminal confirmation precedes writes; no browser is required. All eligible text is analyzed under existing exclusions and limits, rather than claiming literally every file is read. Guidance-only setup is an explicit option. Global installation is supported from a locally built package; publishing is out of scope. These defaults are proposed, not yet approved.

## Setup model research and decision
Researched 2026-10-19 using fetched official documentation:

- [Codex models](https://learn.chatgpt.com/docs/models): recommends GPT-6.1 Sol for complex coding/agentic work and Luna for focused repeatable tasks; availability depends on account and client. Medium balances planning depth and speed.
- [Model selection](https://developers.openai.com/api/docs/guides/model-selection): considers Sol for complex work where cost matters; Luna is the efficiency-oriented option.
- [Deployment checklist](https://developers.openai.com/api/docs/guides/deployment-checklist): medium/high suit code reasoning and planning; xhigh/max should be justified by representative evaluation gains.

Decision (engineering inference, not a measured winner): recommend `gpt-6.1-sol` at explicit `medium` for whole-project setup. Reconciliation across source, specs and agent policy is broader than extraction, so do not make Luna the unqualified default. Offer an available compatible model for explicit selection if Sol is unavailable; never silently choose a different provider or increase effort. Keep extra-high/max an explicit per-run choice. No live model comparison or account availability test was run.

Implementation evidence: `src/server/engines.ts` passes optional model to Codex thread creation and Claude --model, but does not currently send explicit reasoning effort on Codex turns. `src/server/runs.ts` obtains models from agent configuration; `.clinic/agents/*.yaml` currently have blank models. The setup flow therefore needs its own resolved model/effort contract and adapter forwarding. Provider capability discovery must be verified against the packaged CLI versions; API documentation alone does not prove installed app-server compatibility. Claude model IDs and effort support must be resolved through that provider's supported runtime rather than using OpenAI identifiers.

## GUI visibility clarification
During implementation the owner explicitly required terminal setup projects to be visible in the global GUI. The current running source GUI mounts only the Clinic checkout at /projects and uses a separate persistent home volume. Simply copying registrations would produce inaccessible projects outside that mount. The revised design adds exact project mounts and registers through existing Projects/Store services, preserving the original mount and volume. Local Docker inspection established this; no model inference or external service access was used.

## Browser sign-in correction, 2026-10-19
Official source: https://learn.chatgpt.com/docs/auth (fetched). Device-code login requires an account/workspace setting; standard codex login uses localhost:1455 and supports callback forwarding. Packaged Codex 0.163.0 login help confirms normal login and optional --device-auth. Packaged Claude 2.1.302 exposes auth login. Use normal provider login, not account-setting changes. The screenshots establish this user's device-code rejection; they do not prove that browser authentication has completed.

## Missing specifications investigation, 2026-10-19
Read-only dedicated terminal Store records show a prior run failed on an out-of-batch .compnots/PO.md citation. The current example-app run had acknowledged 2 of 26 batches at inspection and had not reached synthesis or review. Existing shared analysis rejects invalid references correctly but has no repair attempts; terminal hides provider-stage wait time. Existing terminal fixture returns empty capabilities, so previous passing tests do not establish meaningful full terminal output. Repository implementation/spec evidence is sufficient; no new external API assumption or live inference is needed.

## Default setup scope correction
The owner's displayed run processes26 eligible-source batches before generating specs. Existing excludedDirectories already skips node_modules and generated directories; the problem is exhaustive first-party analysis as the default. Repository code establishes this cause without external research. Owner confirms openspec/specs/ as the destination and requests initial SDD setup, not a full source audit. Reuse active change and native output, add explicit --deep for prior behavior.

## Validation companions, 2026-10-19
User requested spec validation beside spec.md. Existing baseline renderer emits only spec.md, whereas native workspace navigation already supports validation.md. Reuse existing baseline proposal/apply protections. Deterministic scenario mapping needs no external research or provider calls. Source review alone cannot prove application equivalence; reconstruction scope awaits clarification.

Owner clarification received 2026-10-19: rebuild the existing application from specifications, not merely preserve source. Fast sampled summaries cannot support this goal. Reuse deep inventory and add structured reconstruction synthesis; no external research required for repository-specific generation. Missing binary assets, runtime services and undocumented behavior remain explicit evidence gaps.

2026-10-19 inventory incident: user reports ios/Pods/ReactNativeDependencies/Headers/boost/iterator/iterator_concepts.hpp exhausting 20MB total. project-inventory.ts excludes node_modules/vendor but not Pods. Existing accepted exclusion requirement covers the correction. No external research required; add deterministic subtree pruning and regression evidence.

Docker verification additionally reproduced Git dubious-ownership rejection on /projects, causing ignored exported bundles to enter inventory. The selected-path command-scoped trust override restores ignore handling. A regression injects Git different-owner test mode into the command environment; normal cleanEnv intentionally removes that test-only variable.

2026-10-20 repository investigation: capability validation is generated only in setup-analysis.ts for parsed.capabilities; reused existing capabilities are not backfilled. setup-drafts.ts permits only /spec.md for accepted capability files; SpecRepository.allowed mirrors this restriction. Existing guidance templates are separate from capability evidence and cannot satisfy missing companion checks. CHANGELOG is absent from setup generation/allowlists. Screenshot establishes missing companions in visible folders, but does not establish which installed command/version created them. No external research needed for these code-confirmed defects.
