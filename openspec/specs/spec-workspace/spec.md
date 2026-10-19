# spec-workspace Specification

## Purpose
Keep project intent in native OpenSpec documents and help developers discover, propose, review, validate, and approve specification changes without losing external edits.

## Requirements

### Requirement: Reviewed project setup
Clinic SHALL inspect a selected local project and propose SDD setup without overwriting existing instructions or specs.

#### Scenario: Setup is applied a second time
- **WHEN** setup is applied a second time
- **THEN** Existing instructions remain intact and already managed setup files are not duplicated.

#### Scenario: The repository contains existing schema and test files
- **WHEN** Clinic inspects the project before setup
- **THEN** It identifies bounded schema and test references alongside manifests and instructions, and includes unresolved setup questions for review.

### Requirement: OpenSpec navigation
Clinic SHALL list current specs, proposed changes, and archives from repository files with search and rendered Markdown.

#### Scenario: A file changes outside Clinic
- **WHEN** a file changes outside clinic
- **THEN** The next refresh shows the file and outstanding edits retain their original base revision.

### Requirement: Prompted change proposals
Clinic SHALL turn a prompt against a current spec into a proposed OpenSpec change and show file diffs before applying edits.

#### Scenario: A user accepts a generated proposal
- **WHEN** a user accepts a generated proposal
- **THEN** Only validated proposal paths are written; current behavior specs are not silently replaced.

### Requirement: Conflict-safe editing
Clinic SHALL compare every proposed file against its base content before writing any file.

#### Scenario: One file has changed since an edit was proposed
- **WHEN** one file has changed since an edit was proposed
- **THEN** The complete proposal is rejected as stale and existing content is preserved.

### Requirement: Revision approval
Clinic SHALL validate and hash approved change artifacts before implementation. New capabilities SHALL include a meaningful purpose that can be preserved in accepted specifications.

#### Scenario: An approved artifact changes
- **WHEN** an approved artifact changes
- **THEN** Its approval and dependent QA result are invalidated until the new revision is approved.

#### Scenario: A new capability has no meaningful purpose
- **WHEN** a change introducing a new capability is submitted for approval without a purpose or with a placeholder
- **THEN** Clinic rejects approval and explains that a meaningful Purpose section is required before implementation.

### Requirement: Portable project documentation
Clinic SHALL propose project mission, technology, roadmap and SDD workflow documents plus reusable feature templates during setup. Existing documents and custom OpenSpec settings SHALL be preserved. Detected behavior and unresolved product intent SHALL be labeled for review.
#### Scenario: Initialize project guidance
- **WHEN** setup is reviewed and applied to a new project
- **THEN** its project documents and native OpenSpec feature templates are saved and visible without inventing approved product requirements.
#### Scenario: Adopt an existing project
- **WHEN** setup runs again with customized documents or schema settings
- **THEN** existing content is preserved and only missing or unchanged managed defaults are proposed.
#### Scenario: Project guidance changes after approval
- **WHEN** a mission, technology or roadmap document changes after a change was approved
- **THEN** implementation requires approval of the new context revision.

### Requirement: Complete feature document bundles
New Clinic change proposals SHALL include research, motivation, requirements, design, validation and task artifacts in a single native OpenSpec change folder. Clinic SHALL distinguish scaffolded drafts from implementation-ready plans and retain external OpenSpec workflow compatibility.
#### Scenario: Create a new change
- **WHEN** a user creates a change in a project using Clinic's documentation workflow
- **THEN** a reviewed proposal contains the complete Markdown bundle with explicit draft markers, and applying it does not approve implementation.
#### Scenario: Incomplete validation plan
- **WHEN** a Clinic change has missing artifacts, unresolved scaffold markers or acceptance scenarios absent from its validation plan
- **THEN** approval is rejected with the missing information identified.
#### Scenario: Existing external workflow
- **WHEN** a change uses an existing custom or standard OpenSpec schema
- **THEN** its existing artifacts remain readable and its previous approval contract is retained.
#### Scenario: Edit shared project guidance
- **WHEN** a user edits a project document through Clinic
- **THEN** Clinic presents a reviewable diff and rejects stale edits before changing any file.

### Requirement: Portable agent development instructions
Reviewed setup SHALL provide native project instruction files for Codex, Claude, Gemini CLI, GitHub Copilot and Cursor, plus shared guidance for AGENTS.md-compatible agents. The guidance SHALL direct each development request through specification analysis, needed refinement or creation, review, implementation and verification using authoritative project skills. Setup SHALL preserve custom instructions and upgrade only recognized unchanged Clinic defaults.

#### Scenario: Review portable instructions during setup
- **WHEN** a project without agent guidance is inspected for setup with either supported engine
- **THEN** the setup diff includes AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md and an always-applied Cursor project rule, and no file is written before applying the proposal.

#### Scenario: Route every development request through specifications
- **WHEN** an agent reads generated project guidance before a development request
- **THEN** the guidance requires reading project context and analyzing accepted specs and active changes, refining unclear or changed existing intent, creating specifications for new intent, and implementing only after the relevant review and validation; unchanged matching specs are reused without forced edits, and scenario evidence is required after implementation.

#### Scenario: Upgrade an existing Clinic instruction block
- **WHEN** setup finds the exact previous default instruction block surrounded by project-specific instructions
- **THEN** it proposes replacement of only that block with the complete workflow and preserves the surrounding instructions.

#### Scenario: Preserve custom instructions and repeat setup
- **WHEN** setup finds custom instructions, a customized managed block or existing tool metadata and is subsequently repeated after application
- **THEN** custom content and metadata remain intact, missing guidance is appended where no managed block exists, and the repeated setup proposes no duplicate or unchanged files.

#### Scenario: Reject stale instruction updates
- **WHEN** any proposed instruction file changes before the setup proposal is applied
- **THEN** the whole setup proposal is rejected before writes and the external edit remains intact.

#### Scenario: Refuse unsafe instruction targets
- **WHEN** a setup instruction target traverses a symbolic link or a proposal attempts an unsupported tool configuration path
- **THEN** setup rejects the target without writing outside the allowed project instruction files.

### Requirement: Existing project specification baseline
Setup SHALL analyze eligible project source, tests, configuration and documentation recursively and propose native capability specifications with source references and a coverage report. All generated behavior SHALL be labeled inferred for review, with contradictions and uncertainty exposed. Existing specifications and custom agent instructions SHALL be preserved. Applying a reviewed baseline SHALL create specs and portable setup files without claiming implementation or passing tests.

#### Scenario: Analyze nested source and documentation
- **WHEN** setup analysis runs on an existing project with source and documents nested beyond the quick inspection depth
- **THEN** every eligible file and complete text chunk is supplied to analysis, related behaviors are grouped into capability specs with purpose, requirements, scenarios and valid source references, and coverage identifies all included files.

#### Scenario: Disclose excluded and unavailable content
- **WHEN** a repository contains dependencies, generated output, ignored files, credentials, binary files, symlinks or unreadable content
- **THEN** excluded content is identified by reason without exposing credential values, symlinks are not followed, and unexpected read failures or resource limits stop baseline generation with an actionable error rather than a claim of full analysis.

#### Scenario: Review inferred behavior with portable instructions
- **WHEN** analysis completes successfully
- **THEN** Clinic validates and displays a proposal containing new openspec/specs/<capability>/spec.md files, a source/coverage report and missing or safely upgradable agent instruction files; no project files change until the proposal is applied, and code/document contradictions remain explicit review questions.

#### Scenario: Preserve an existing specification baseline
- **WHEN** a project already contains accepted specs, active changes or custom instructions and setup is repeated
- **THEN** analysis considers their intent, records reuse or gaps, does not overwrite existing capability specs or create duplicate paths, and preserves the custom instructions through the existing setup rules.

#### Scenario: Sources change before baseline application
- **WHEN** source or documentation is changed, added or removed after analysis or a proposed target changes
- **THEN** the whole baseline proposal is rejected before writing files and the user is directed to reanalyze the current project.

#### Scenario: Provider output or analysis is incomplete
- **WHEN** an analysis omits supplied chunks, cites nonexistent source locations, returns invalid output, fails, is canceled or is interrupted by restart
- **THEN** no baseline proposal is applied or represented as complete; progress and a specific failure/interruption remain available and retry requires an explicit action.

#### Scenario: No inferable capability exists
- **WHEN** analysis finds no supported behavior or all behavior is already specified
- **THEN** the report explains the result without inventing capabilities or creating empty placeholder specifications.

### Requirement: Product source project setup
Clinic SHALL generate reviewable new-project SDD packages from prompts and supported product documents or images, preserving source evidence and existing intent.

#### Scenario: Prompt and attachment setup
- **WHEN** a user supplies a prompt, supported documents or images for a new or existing destination
- **THEN** Clinic analyzes all accepted inputs and proposes native capability specs, project and UI/UX guidance, original sources and portable agent instructions without writing the destination.

#### Scenario: Clarify conflicting product sources
- **WHEN** important intent is missing or contradictory
- **THEN** setup asks focused questions, retains answers and does not produce an applicable final proposal until blocking decisions are resolved.

#### Scenario: Review and apply new project package
- **WHEN** the owner applies the reviewed setup
- **THEN** Clinic creates the destination if needed and saves the reviewed package, preserves existing custom files and specs, and does not initialize Git or implement the product.

#### Scenario: Recover setup and reject incomplete sources
- **WHEN** uploads are unreadable or unsupported, the provider is disconnected, or a run stops
- **THEN** Clinic retains the draft, explains the problem and requires explicit correction or retry without silently omitting content.

#### Scenario: Protect changed setup destinations
- **WHEN** a source or destination changes after generation
- **THEN** application rejects stale proposals before writing and requires regeneration.
