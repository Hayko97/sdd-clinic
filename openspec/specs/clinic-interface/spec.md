# clinic-interface Specification

## Purpose
Give developers a searchable, responsive workspace for projects, documents, prompt conversations, agents, evidence, and the progress of specification-driven work.

## Requirements

### Requirement: Spec-centered workspace
Clinic SHALL group current specifications by capability and show related change proposals, designs, tasks and delta Markdown files. Selecting a document SHALL open its content or diff with visible project context and a return to the workspace. Search SHALL remain scoped to the selected project.

#### Scenario: A user selects a spec and submits a prompt
- **WHEN** a user selects a spec and submits a prompt
- **THEN** The conversation stays associated with that project and selected change.

#### Scenario: Inspect a capability and its documents
- **WHEN** a user opens a specification group
- **THEN** the current spec and associated active-change Markdown files are selectable, and changes without a capability delta remain accessible in a separate change group.

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

### Requirement: Conversational Developer workspace
Clinic SHALL show Developer prompts and readable outcomes as a chronological project conversation above a persistent composer, with the selected agent, CLI and model visible. Active work SHALL show streamed activity, interruption and inline review/approval controls. Planning protocol JSON SHALL not be presented as the assistant's chat response.
#### Scenario: Send a prompt and follow its work
- **WHEN** a user sends a Developer prompt
- **THEN** the transcript shows their message, skill-stage progress, readable outcomes and the relevant spec-review or clarification action without leaving the project.
#### Scenario: Compose using keyboard controls
- **WHEN** the user presses Enter, Shift+Enter, Up on an empty draft, or Escape during active work
- **THEN** Clinic respectively sends, adds a newline, recalls prompt history, or interrupts work; IME composition does not accidentally submit.
#### Scenario: Draft and project context survive navigation
- **WHEN** the user leaves and returns to a project or reloads the browser
- **THEN** its draft and stored conversation remain available without exposing another project's draft or messages.
#### Scenario: Provider is disconnected
- **WHEN** the user tries to send without a connected provider
- **THEN** Clinic offers connection setup and retains the draft.
#### Scenario: Narrow viewport and long messages
- **WHEN** the chat is used at 375px with long messages and tool activity
- **THEN** the composer, transcript and required actions remain usable without page overflow.
#### Scenario: Watch implementation while files change
- **WHEN** the conversation refreshes implementation status while Developer writes or commits changes
- **THEN** the read request does not modify Git's index or compete for its write lock.

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

### Requirement: Complete specification document navigation
The project workspace SHALL expose project guidance and each capability's current documents, active change artifacts and archived history together. It SHALL distinguish these lifecycles, keep unrelated change drafts accessible, and count capabilities independently of supporting document count.
#### Scenario: Inspect an established capability
- **WHEN** a capability has only archived changes
- **THEN** its proposal, design, tasks and other historical documents remain reachable within that capability group alongside its current spec.
#### Scenario: Browse project guidance
- **WHEN** a configured project is opened
- **THEN** its mission, technology, roadmap and workflow documents can be read and edited from the workspace without a separate menu.
#### Scenario: Supporting files and project separation
- **WHEN** supporting Markdown files are added or the selected project changes
- **THEN** document lists reflect only that project and the project's spec count represents distinct current capabilities.
#### Scenario: Narrow document navigation
- **WHEN** a document-rich project is opened at 375px width
- **THEN** all document groups and controls remain usable without horizontal overflow.

### Requirement: Existing project setup analysis review
Clinic SHALL offer comprehensive project analysis during setup, display durable progress and coverage, and make the resulting specification/agent-file diff reviewable before application. Provider-free setup SHALL remain available and explicitly indicate that semantic analysis has not run.

#### Scenario: Follow and review setup analysis
- **WHEN** setup starts with the project's configured CLI connected
- **THEN** the user can follow and stop analysis, return after reload, review its coverage and inferred specs together with agent files, and apply the proposal to expose the new capabilities in the workspace.

#### Scenario: Set up files without a provider
- **WHEN** setup runs without a connected configured CLI or the user selects files-only setup
- **THEN** Clinic offers local instruction/skill/document installation, clearly says source-derived specs were not generated, and keeps project analysis available after connecting a CLI.
