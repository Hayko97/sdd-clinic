## ADDED Requirements

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
