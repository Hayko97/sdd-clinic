## MODIFIED Requirements
### Requirement: Complete management views
Clinic SHALL provide projects, specs, agents, skills, backlog, runs, and connections views with usable empty and error states. Registered project documents SHALL remain browsable without provider authentication, and the first registered project SHALL be selected when no valid selection exists.
#### Scenario: The workspace has no projects
- **WHEN** the workspace has no projects
- **THEN** Clinic offers connection and project setup instead of fabricated sample records.
#### Scenario: Existing project has no connected engine
- **WHEN** the user opens Clinic with a registered project and disconnected engines
- **THEN** its specifications, agents and installed skills remain accessible while provider operations still require a connection.
