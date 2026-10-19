## ADDED Requirements
### Requirement: Scannable project agent cards
Clinic SHALL present the selected project's agents as responsive cards with name, role summary, resolved engine/model, configured trigger and execution limits. Full instructions SHALL be expandable. Each card SHALL expose labeled configuration and duplication actions plus its supported execution or specification navigation action. Search SHALL filter agents by name, role and instructions without altering their configuration.

#### Scenario: Find and inspect an agent
- **WHEN** a user searches for a role or instruction phrase
- **THEN** only matching project agents remain visible and the user can expand their full instructions and configure the selected agent.

#### Scenario: No agents match
- **WHEN** the search has no matches
- **THEN** Clinic shows a no-results message and a clear-search action that restores the project's cards.

#### Scenario: View cards on a narrow screen
- **WHEN** the Agents page is opened at 375px width
- **THEN** cards form one column and their metadata and keyboard-accessible actions remain visible without horizontal page overflow.

#### Scenario: Engine or trigger is inherited
- **WHEN** an agent inherits its project's engine or uses an automatic trigger
- **THEN** the card displays the resolved engine and actual trigger without implying a scheduled run is enabled or currently executing.

## MODIFIED Requirements
### Requirement: Complete management views
Clinic SHALL open on a global Projects home listing registered projects with setup status and spec/agent/skill counts. Registration, reviewed setup and document browsing SHALL work without provider sign-in. Projects, specs, agents, skills, backlog, runs and connections SHALL have usable empty/error states. Invalid project selections SHALL default to the first registered project.

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

