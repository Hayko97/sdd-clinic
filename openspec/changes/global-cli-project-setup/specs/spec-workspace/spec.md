## ADDED Requirements

### Requirement: Terminal project setup
Clinic SHALL offer interactive sddclinic setup for the current directory or an explicit path, reusing reviewed baseline setup without requiring the Clinic GUI and applying no project files before explicit confirmation.

#### Scenario: Analyze project assets before setup
- **WHEN** terminal setup runs with a connected selected provider
- **THEN** it inventories eligible source, documentation, accepted specs, active changes, project context, agent definitions and skills and reports reuse, gaps, conflicts, coverage and exclusions before presenting the complete proposed diff.

#### Scenario: Apply a reviewed terminal proposal
- **WHEN** the user confirms the displayed current proposal
- **THEN** Clinic validates and applies it through existing setup protections, preserves custom files and reports written paths without implementing product code or performing Git integration.

#### Scenario: Repeat terminal setup
- **WHEN** setup is rerun on a configured project
- **THEN** existing specs and customized agents, instructions and skills are preserved and no duplicate managed setup is created.

#### Scenario: Reject changed terminal setup evidence
- **WHEN** sources or proposal targets change before confirmation is applied
- **THEN** the whole proposal is rejected without partial setup writes and the command requests reanalysis.

#### Scenario: Handle missing provider authentication
- **WHEN** full analysis is requested without the selected provider authenticated
- **THEN** setup automatically opens the selected provider’s browser sign-in, waits for completion in its runtime and verifies authentication before analysis; it does not silently switch provider or mode.

#### Scenario: Choose guidance only in the terminal
- **WHEN** the user explicitly supplies --guidance-only
- **THEN** setup reviews local guidance additions without inference and clearly reports code-derived analysis was not performed.

#### Scenario: Decline or interrupt terminal setup
- **WHEN** the user declines application or cancels analysis
- **THEN** no setup proposal is applied and the terminal reports the outcome.

#### Scenario: Fail incomplete terminal analysis
- **WHEN** analysis fails, exceeds supported limits or returns incomplete coverage
- **THEN** setup reports the failure and does not offer the incomplete result as a complete applicable baseline.

#### Scenario: Reject noninteractive setup
- **WHEN** setup runs without an interactive terminal
- **THEN** it exits before analysis or mutation with instructions for interactive review rather than treating absent input as consent.

#### Scenario: Browser sign-in without device-code access
- **WHEN** Codex setup needs sign-in and account device-code sign-in is disabled
- **THEN** setup uses normal browser sign-in with a working local callback into its runtime, without requiring the account setting to be changed.

#### Scenario: Browser launch or callback fails
- **WHEN** the system browser cannot open or the local callback port is unavailable
- **THEN** setup prints a usable manual link for browser-launch failure, or actionable callback-port guidance for port failure, and never claims authentication succeeded.

#### Scenario: Cancel browser sign-in
- **WHEN** the user interrupts pending browser sign-in
- **THEN** provider login and temporary callback forwarding stop, no analysis or setup writes occur, and a later attempt can start again.

#### Scenario: Reuse authenticated setup runtime
- **WHEN** the selected provider is already authenticated or guidance-only setup is requested
- **THEN** setup does not open a sign-in browser or reserve a provider callback port.

#### Scenario: Repair invalid analysis evidence
- **WHEN** a provider response contains invalid JSON, incomplete chunk coverage or unsupported source citations
- **THEN** setup explains the validation problem and makes bounded correction attempts using the same evidence and selected model, accepting only fully validated output and failing explicitly if correction is exhausted.

#### Scenario: Show progress during specification generation
- **WHEN** setup is analyzing batches or synthesizing specifications
- **THEN** the terminal shows the current stage, batch counts and elapsed waiting progress, then identifies the proposed capability spec paths and requires review before writing them.

#### Scenario: Do not report specification setup without specifications
- **WHEN** full terminal setup produces no capability specs for a project with no existing native capability specifications
- **THEN** it explains that no specification baseline was produced and provides the analysis findings or missing-evidence questions without claiming SDD setup succeeded or applying only guidance as full setup.

#### Scenario: Create the project specification baseline
- **WHEN** full terminal setup analyzes supported behavior in an unspecified project and the owner applies its validated proposal
- **THEN** openspec/specs/<capability>/spec.md files contain meaningful purpose, observable SHALL requirements, WHEN/THEN scenarios and source references, and the terminal reports the written specification paths.

#### Scenario: Start specification-driven development without a full audit
- **WHEN** the user runs terminal setup with its default options
- **THEN** it uses bounded project context to generate an initial reviewable capability specification set directly, preserves existing intent, excludes dependencies and generated files, and explicitly labels the coverage as an initial overview rather than exhaustive implementation analysis.

#### Scenario: Request exhaustive baseline analysis
- **WHEN** the user explicitly supplies --deep
- **THEN** setup performs the full eligible-source batch analysis before synthesis and review, with progress and the existing validation protections.

#### Scenario: Existing intent exceeds initial context bounds
- **WHEN** existing specifications cannot fit safely within the initial overview
- **THEN** setup explains that deeper analysis is needed instead of ignoring existing intent or generating duplicate specifications.

### Requirement: Baseline validation companions
Each newly generated baseline capability, including prompt/document GUI setup, SHALL include a validation.md beside spec.md, mapping every requirement and scenario to a reproducible behavioral check and expected evidence. Checks SHALL initially be unverified. Setup SHALL preserve application code and existing specification documents, and SHALL not claim exact reconstruction or tested equivalence from source analysis.

#### Scenario: Generate scenario validation plans
- **WHEN** setup proposes a new capability baseline in initial, deep, rebuild or prompt/document GUI mode
- **THEN** its validation.md identifies every requirement and scenario, conditions, expected observations and evidence to record, with unverified status and no invented test execution results.

#### Scenario: Preserve existing validation and application code
- **WHEN** a proposed companion path already exists or the proposal is applied
- **THEN** existing companion documents are never overwritten and application source remains unchanged; conflicting baseline paths stop proposal generation before writes.

#### Scenario: Distinguish baseline from reconstruction evidence
- **WHEN** setup presents generated specifications and validation plans
- **THEN** it explains that these are reviewed starting documents, not proof that a future implementation recreates the whole application, and requires actual scenario execution to establish behavior.

### Requirement: Reconstruction-oriented setup
Clinic SHALL offer explicit --rebuild setup that reads all eligible project text and produces a self-contained reconstruction guide alongside native behavior specifications and validation plans. It SHALL separate captured contracts from unknown or inapplicable areas, preserve existing code, and never represent source inspection as verified reconstruction equivalence.

#### Scenario: Capture a reconstruction blueprint
- **WHEN** the owner selects --rebuild and approves the resulting proposal
- **THEN** openspec/project/reconstruction.md contains supported project purpose, architecture, workflows, interface contracts, data rules, presentation/assets, operations/dependencies and a clean-room verification plan, with evidence references, explicit gaps and links to capability specs.

#### Scenario: Reject incomplete reconstruction output
- **WHEN** reconstruction output omits a required area, supplies unsupported evidence or lacks explicit unknowns for uncaptured areas
- **THEN** setup requests bounded corrections and fails without project writes if output remains invalid.

#### Scenario: Preserve reconstruction documents
- **WHEN** the reconstruction guide already exists or sources change during analysis
- **THEN** setup preserves customized content and rejects stale proposals; previously managed guides may only be replaced through the current reviewed proposal.

#### Scenario: Report reconstruction readiness honestly
- **WHEN** setup renders a reconstruction guide
- **THEN** it lists unknowns and excluded evidence, labels all implementation/equivalence checks unverified, and describes comparison of a clean-room implementation against recorded behavior without executing application code.


### Requirement: Repair incomplete SDD documentation
Clinic SHALL offer `sddclinic setup --repair` for existing projects and SHALL include missing-document repair in ordinary setup. Repair SHALL derive missing capability validation plans from existing native specifications without model inference or application-source analysis. Repair SHALL present a complete diff before writes, preserve existing specifications and customized documents, and report written, preserved and unresolved files accurately.

#### Scenario: Repair spec-only capability folders
- **WHEN** an existing project contains native capability specs with requirements and scenarios but lacks companion validation plans
- **THEN** repair proposes a validation.md beside every such spec with each scenario, its conditions and expected result, evidence to record and UNVERIFIED status, plus missing project workflow and agent setup documents, without provider sign-in or model calls.

#### Scenario: Repeat repair without changing existing documents
- **WHEN** repair is applied and run again without project changes
- **THEN** it creates no duplicate files or history entries and preserves existing specs, validation plans, custom guidance and application code byte-for-byte.

#### Scenario: Reject stale or unusable repair inputs
- **WHEN** a specification cannot supply valid scenario checks, or a source specification or target changes after review
- **THEN** repair identifies the problem and refuses to apply an incomplete or stale proposal without partial writes or claims of complete SDD readiness.

#### Scenario: Repair does not invent product specifications
- **WHEN** repair runs in a project without capability specifications
- **THEN** it explains that repair cannot infer a product baseline and directs the user to initial source setup or prompt/document setup without claiming that a guidance scaffold is a complete specification set.

### Requirement: Setup documentation contract and changelog
Full setup SHALL include capability specs and validation companions, shared project guidance, agent instructions/skills, and native change templates. It SHALL create a root CHANGELOG.md with an honest Unreleased SDD initialization entry only when no case-insensitive equivalent exists. It SHALL NOT invent release history, implementation or test results, or fabricate change records to populate filenames.

#### Scenario: Create a complete new-project documentation package
- **WHEN** an owner applies source-based or prompt/document setup to a project lacking SDD files
- **THEN** the reviewed package includes each capability's spec.md and validation.md, openspec/config.yaml, mission/tech-stack/roadmap/workflow guidance, native research/proposal/spec/design/validation/tasks templates, agent instructions and skills, and CHANGELOG.md, and reports any unresolved intent without claiming implementation exists.

#### Scenario: Preserve an existing changelog
- **WHEN** a project already has CHANGELOG.md, changelog.md or another case variant
- **THEN** setup preserves its contents and does not create a competing changelog or invent entries for earlier work.

#### Scenario: Review documentation before applying
- **WHEN** a user declines or cancels the setup or repair proposal
- **THEN** no specification, validation document, guidance or changelog is written and the operation does not report successful application.

### Requirement: Evidence-based setup quality
Clinic SHALL evaluate setup artifacts against supplied evidence before proposing an applicable baseline, preserve required intent and expose limitations without claiming semantic completeness or test execution.

#### Scenario: Select representative implementation evidence
- **WHEN** initial setup inspects nested UI, services, SQL and tests with behavior below imports
- **THEN** bounded line-aware selection includes representative implementation and test evidence and records every omitted range; existing intent is retained in full or setup requests deep analysis.

#### Scenario: Reject generic validation plans
- **WHEN** a generated scenario has only restated WHEN/THEN text, placeholders, missing prerequisites or unsupported existing-test references
- **THEN** setup rejects the output before proposal creation and makes bounded correction attempts; accepted plans distinguish existing, proposed and manual checks and remain unverified.

#### Scenario: Review all applicable quality areas
- **WHEN** initial, deep, rebuild or product-source setup generates specifications
- **THEN** a bounded semantic review covers project purpose, architecture, interfaces, data, workflows, UI/UX, authentication, security, operations, nonfunctional constraints and verification with evidence or explicit unknown/not-applicable reasons; blocking generation defects prevent application.

#### Scenario: Preserve required intent despite implementation gaps
- **WHEN** documented intent or a recorded owner decision conflicts with implementation
- **THEN** the required behavior remains intact and the review records an implementation gap separately from unresolved product decisions, observations and test results.

#### Scenario: Generate substantive project guidance
- **WHEN** source-backed setup proposes missing project documents
- **THEN** mission, architecture, contracts, UI applicability, operational prerequisites and roadmap are rendered from reviewed evidence and explicit gaps rather than generic scaffolding; existing customized guidance remains intact.

#### Scenario: Record portable setup provenance
- **WHEN** a generated package is ready for review
- **THEN** its report records source hashes and selected ranges, generated artifact hashes, exact managed OpenSpec version and separate unverified review/execution state; dirty source is not treated as committed or tested.

#### Scenario: Label provider-free repair scaffolds
- **WHEN** guidance-only setup or repair derives a companion without implementation evidence
- **THEN** the companion is explicitly an incomplete draft requiring concrete fixtures, actions and assertions before implementation approval, and does not present generic steps as an executable validation plan.
