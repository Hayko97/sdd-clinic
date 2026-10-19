## ADDED Requirements
### Requirement: Connections in project chat
Clinic SHALL support pasting, saving and managing data/server credentials in the project composer without a dedicated connection setup page or multi-field form. Recognized credentials SHALL use a transient input mode, with the selected recipient agent visible. Saved sources SHALL provide contextual update, test and remove actions.
#### Scenario: Paste credentials into the composer
- **WHEN** the user pastes recognized connection details or chooses credentials mode
- **THEN** the composer offers Save connection, identifies the recipient agent and excludes the input from persisted browser drafts and chat history.
#### Scenario: Return to a project
- **WHEN** the user reloads or reopens a project after saving
- **THEN** its sources and assigned agents remain visible while the credential input is cleared; another project's sources remain separate.
#### Scenario: No provider is connected
- **WHEN** the user saves connection details without a signed-in CLI
- **THEN** local saving works without model execution and the user can test the connection explicitly.
#### Scenario: Narrow screen
- **WHEN** the workspace is viewed at 375px
- **THEN** the composer, recipient selection and saved-source actions remain usable without page overflow.
#### Scenario: Switch projects during background refresh
- **WHEN** the user opens another project while a previous request is still loading
- **THEN** the composer becomes available only with the requested project's context, and stale responses cannot retarget a credential save.
