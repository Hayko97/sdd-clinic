# local-runtime Specification

## Purpose
Run a reliable single-user local service with portable storage, authenticated browser access, durable event replay, interruption recovery, and separation between projects.

## Requirements

### Requirement: Local browser session
Clinic SHALL bind to loopback and require a valid browser session for project, run, and credential APIs.

#### Scenario: A foreign web origin sends a mutation
- **WHEN** a foreign web origin sends a mutation
- **THEN** The server rejects the request.

### Requirement: Durable event replay
Clinic SHALL persist run events before streaming them and replay events after a client cursor.

#### Scenario: A browser reconnects
- **WHEN** a browser reconnects
- **THEN** It receives missed events without restarting the provider action.

### Requirement: Interrupted-run recovery
Clinic SHALL mark unfinished runs interrupted on restart and preserve their events and workspaces.

#### Scenario: The service stops during implementation
- **WHEN** the service stops during implementation
- **THEN** The next launch reports interruption and does not silently rerun the action.

### Requirement: Project isolation
Clinic SHALL scope all specifications, conversations, runs, findings, and connections to their owning project.

#### Scenario: A request combines resources from two projects
- **WHEN** a request combines resources from two projects
- **THEN** Clinic rejects the cross-project operation.

### Requirement: Portable launch
Clinic SHALL provide start and doctor commands and build a distributable application package.

#### Scenario: Doctor runs without installed providers
- **WHEN** doctor runs without installed providers
- **THEN** It reports missing dependencies without attempting an inference request.
