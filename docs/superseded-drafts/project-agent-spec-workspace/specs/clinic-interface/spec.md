## MODIFIED Requirements
### Requirement: Spec-centered workspace
Clinic SHALL show spec navigation, a document or diff view, and a prompt conversation with visible attached context. Opening a project SHALL display its name and repository path, its specifications, and accessible Agents and Skills views. Users SHALL be able to return to the global project grid. A user MAY explicitly ask an agent to assess a selected spec and propose a rewrite; opening the project alone SHALL NOT invoke an agent or alter documents.

#### Scenario: A user selects a spec and submits a prompt
- **WHEN** a user selects a spec and submits a prompt
- **THEN** The conversation stays associated with that project and selected change.

#### Scenario: Open a project and inspect agents
- **WHEN** the user opens a project card and chooses Agents
- **THEN** Clinic shows that project's agent definitions and offers navigation back to its specifications, its skills and the global grid.

#### Scenario: Request an agent review of a spec
- **WHEN** the user selects a spec and asks for review or rewriting
- **THEN** the visible context identifies the project, selected spec and relevant existing requirements, and the agent reports issues and overlap before proposing necessary changes.

#### Scenario: No rewrite is necessary
- **WHEN** an agent's requested review finds the selected spec already expresses the requested behavior
- **THEN** the result explains the matching requirements and does not create duplicate requirements or an unnecessary change.

#### Scenario: Review a proposed rewrite
- **WHEN** an agent proposes a rewrite of an accepted spec
- **THEN** the proposal targets an OpenSpec change, the user can inspect its diff and choose whether to apply it, and accepted specs remain unchanged until the existing finalization workflow.

#### Scenario: Switch projects with an outstanding proposal
- **WHEN** the user opens another project while a proposal or conversation exists
- **THEN** the other workspace shows only its own documents, agents and conversations, and the original proposal remains associated with its original project.

#### Scenario: Review requires a provider connection
- **WHEN** the user requests agent review without a connected engine
- **THEN** Clinic explains how to connect while retaining the selected spec and entered prompt, and browsing remains available.
