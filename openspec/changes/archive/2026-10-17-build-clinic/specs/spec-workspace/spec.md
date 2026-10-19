## ADDED Requirements

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
Clinic SHALL validate and hash approved change artifacts before implementation.

#### Scenario: An approved artifact changes
- **WHEN** an approved artifact changes
- **THEN** Its approval and dependent QA result are invalidated until the new revision is approved.
