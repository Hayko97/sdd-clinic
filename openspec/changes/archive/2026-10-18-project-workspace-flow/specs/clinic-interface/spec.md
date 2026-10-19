## MODIFIED Requirements
### Requirement: Complete management views
Clinic SHALL have a project-card home and one workspace per project, without a persistent sidebar or separate Agents destination. Each workspace SHALL show its agents, schedules, skills, grouped specs and Developer prompt together. Related settings and evidence SHALL open contextually, with a simple return to the project or home. Browsing and reviewed setup SHALL work without provider sign-in.

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


#### Scenario: Open a project
- **WHEN** a user opens a card from the project grid
- **THEN** the project's agents, configured schedules, specification groups and Developer composer are visible on the same workspace with no sidebar menu.

### Requirement: Spec-centered workspace
Clinic SHALL group current specifications by capability and show related change proposals, designs, tasks and delta Markdown files. Selecting a document SHALL open its content or diff with visible project context and a return to the workspace. Search SHALL remain scoped to the selected project.

#### Scenario: A user selects a spec and submits a prompt
- **WHEN** a user selects a spec and submits a prompt
- **THEN** The conversation stays associated with that project and selected change.


#### Scenario: Inspect a capability and its documents
- **WHEN** a user opens a specification group
- **THEN** the current spec and associated active-change Markdown files are selectable, and changes without a capability delta remain accessible in a separate change group.

### Requirement: Scannable project agent cards
Clinic SHALL present the selected project's agents as responsive cards with name, role summary, resolved engine/model, configured trigger and execution limits. Full instructions SHALL be expandable. Each card SHALL expose labeled configuration and duplication actions plus its supported execution or specification navigation action. Search SHALL filter agents by name, role and instructions without altering their configuration.

#### Scenario: Find and inspect an agent
- **WHEN** a user searches for a role or instruction phrase
- **THEN** only matching project agents remain visible and the user can expand their full instructions and configure the selected agent.

#### Scenario: No agents match
- **WHEN** the search has no matches
- **THEN** Clinic shows a no-results message and a clear-search action that restores the project's cards.

#### Scenario: View cards on a narrow screen
- **WHEN** the project workspace is opened at 375px width
- **THEN** cards form one column and their metadata and keyboard-accessible actions remain visible without horizontal page overflow.

#### Scenario: Engine or trigger is inherited
- **WHEN** an agent inherits its project's engine or uses an automatic trigger
- **THEN** the card displays the resolved engine and actual trigger without implying a scheduled run is enabled or currently executing.
