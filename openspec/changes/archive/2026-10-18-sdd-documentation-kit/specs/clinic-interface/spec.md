## ADDED Requirements

### Requirement: Complete specification document navigation
The project workspace SHALL expose project guidance and each capability's current documents, active change artifacts and archived history together. It SHALL distinguish these lifecycles, keep unrelated change drafts accessible, and count capabilities independently of supporting document count.
#### Scenario: Inspect an established capability
- **WHEN** a capability has only archived changes
- **THEN** its proposal, design, tasks and other historical documents remain reachable within that capability group alongside its current spec.
#### Scenario: Browse project guidance
- **WHEN** a configured project is opened
- **THEN** its mission, technology, roadmap and workflow documents can be read and edited from the workspace without a separate menu.
#### Scenario: Supporting files and project separation
- **WHEN** supporting Markdown files are added or the selected project changes
- **THEN** document lists reflect only that project and the project's spec count represents distinct current capabilities.
#### Scenario: Narrow document navigation
- **WHEN** a document-rich project is opened at 375px width
- **THEN** all document groups and controls remain usable without horizontal overflow.
