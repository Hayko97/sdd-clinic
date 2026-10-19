# clinic-api Specification

## Purpose
Expose predictable authenticated project-scoped commands for workspaces, Developer workflows and schedules, with durable results and recoverable errors.

## Requirements

### Requirement: Project-scoped workflow endpoints
The API SHALL allow starting, listing, continuing and canceling Developer workflows under a project. Inputs SHALL be validated and foreign-project resources rejected. Continuation SHALL require an explicit command; reads SHALL never repeat provider actions.
#### Scenario: Start and inspect
- **WHEN** a valid prompt targets a configured Developer
- **THEN** the API returns workflow and run identities which the workspace can poll or inspect through existing run events.
#### Scenario: Cross-project continuation
- **WHEN** a continuation requests a workflow owned by another project
- **THEN** the API rejects it without changing either project.

### Requirement: Schedule endpoint validation
The API SHALL list and save project schedule definitions and their latest runtime outcomes. It SHALL validate agent ownership, cadence and task inputs before writing repository configuration.
#### Scenario: Malformed schedule
- **WHEN** the client supplies an invalid cadence or unknown agent
- **THEN** the API returns a useful error and writes no schedule.
