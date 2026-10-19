## ADDED Requirements

### Requirement: Spec-centered workspace
Clinic SHALL show spec navigation, a document or diff view, and a prompt conversation with visible attached context.

#### Scenario: A user selects a spec and submits a prompt
- **WHEN** a user selects a spec and submits a prompt
- **THEN** The conversation stays associated with that project and selected change.

### Requirement: Complete management views
Clinic SHALL provide projects, specs, agents, backlog, runs, and connections views with usable empty and error states.

#### Scenario: The workspace has no projects
- **WHEN** the workspace has no projects
- **THEN** Clinic offers connection and project setup instead of fabricated sample records.

### Requirement: Reviewable actions
Clinic SHALL expose generated diffs, approval requests, QA evidence, run cancellation, and finalization status.

#### Scenario: An operation fails
- **WHEN** an operation fails
- **THEN** The interface retains user input and presents the actionable error.

### Requirement: Accessible responsive layout
Clinic SHALL support keyboard-accessible controls, labelled inputs, and a layout usable on narrower browser windows.

#### Scenario: The viewport narrows
- **WHEN** the viewport narrows
- **THEN** Navigation and editing remain accessible without hiding required actions.
