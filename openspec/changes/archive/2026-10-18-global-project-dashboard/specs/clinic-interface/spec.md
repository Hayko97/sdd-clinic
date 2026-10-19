## MODIFIED Requirements
### Requirement: Complete management views
Clinic SHALL open on a global Projects home listing every registered project with setup status and specification, agent and skill counts. Users SHALL be able to register a repository and review/apply SDD setup without provider sign-in. Clinic SHALL provide projects, specs, agents, skills, backlog, runs, and connections views with usable empty and error states. Registered project documents SHALL remain browsable without provider authentication, and the first registered project SHALL be selected when no valid selection exists.
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

