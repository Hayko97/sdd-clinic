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
Each newly generated baseline capability SHALL include a validation.md beside spec.md, mapping every requirement and scenario to a reproducible behavioral check and expected evidence. Checks SHALL initially be unverified. Setup SHALL preserve application code and existing specification documents, and SHALL not claim exact reconstruction or tested equivalence from source analysis.

#### Scenario: Generate scenario validation plans
- **WHEN** setup proposes a new capability baseline in initial or deep mode
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
