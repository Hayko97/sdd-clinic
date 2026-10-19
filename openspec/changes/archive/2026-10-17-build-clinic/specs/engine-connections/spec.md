## ADDED Requirements

### Requirement: CLI-first connection
Clinic SHALL discover Codex and Claude executables, support a custom path, and report version, capabilities, and authentication separately.

#### Scenario: A missing executable is selected
- **WHEN** a missing executable is selected
- **THEN** Clinic displays installation guidance without claiming a successful connection.

### Requirement: Persistent provider conversations
Clinic SHALL preserve provider session identifiers and normalize streamed output, tool activity, completion, failure, and interruption.

#### Scenario: A user continues a conversation
- **WHEN** a user continues a conversation
- **THEN** The selected engine resumes its own session; a different engine receives a fresh session with prior context.

### Requirement: Approval handling
Clinic SHALL expose tool approval requests in the UI and return the chosen decision to the provider.

#### Scenario: A provider requests an unapproved action
- **WHEN** a provider requests an unapproved action
- **THEN** The run waits for an explicit decision and interruption resolves the pending request safely.

### Requirement: Connection tests
Clinic SHALL distinguish local authentication diagnostics from an explicitly started inference test.

#### Scenario: Credentials are absent or the provider denies access
- **WHEN** credentials are absent or the provider denies access
- **THEN** The test reports failure with provider guidance and does not mark the engine connected.
