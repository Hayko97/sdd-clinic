## MODIFIED Requirements
### Requirement: Complete management views
Clinic SHALL open on a responsive grid of all registered projects regardless of prior selection. Cards SHALL show name, path, setup status and spec/agent/skill counts, with open/setup actions. Registration, reviewed setup and browsing SHALL work without provider sign-in. Specs, agents, skills, backlog, runs and connections SHALL have usable empty/error states. An invalid project selection SHALL default to the first registered project.

#### Scenario: The workspace has no projects
- **WHEN** the workspace has no projects
- **THEN** Clinic offers connection and project setup instead of fabricated sample records.
#### Scenario: Existing project has no connected engine
- **WHEN** the user opens Clinic with a registered project and disconnected engines
- **THEN** its specifications, agents and installed skills remain accessible while provider operations still require a connection.

#### Scenario: Global home after opening Clinic
- **WHEN** the user opens Clinic
- **THEN** all registered projects are listed with setup status and repository-backed counts, and each project can be opened or set up from the GUI.

#### Scenario: Project setup without provider sign-in
- **WHEN** the user registers a mounted repository without a connected CLI
- **THEN** Clinic proposes setup changes for review and applying them installs the project context, agents and skills without model execution.

#### Scenario: Return to the first page
- **WHEN** a user opens or reloads Clinic after previously viewing a project's documents
- **THEN** the first page shows the global project grid and the prior selection does not hide other registered projects.

#### Scenario: Distinguish similarly named projects
- **WHEN** multiple registered projects share a display name
- **THEN** their cards show repository paths and open the project associated with the selected card.

#### Scenario: An unavailable repository
- **WHEN** a registered repository cannot be read
- **THEN** its card shows Unavailable with an actionable explanation, does not present unknown counts as zero, and other project cards remain usable.

#### Scenario: Grid at a narrow viewport
- **WHEN** the viewport narrows to a phone width
- **THEN** cards reflow into a single column and project names, setup status and actions remain readable and keyboard accessible without horizontal page scrolling.
