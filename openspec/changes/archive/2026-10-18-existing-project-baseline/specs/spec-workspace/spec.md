## ADDED Requirements

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
