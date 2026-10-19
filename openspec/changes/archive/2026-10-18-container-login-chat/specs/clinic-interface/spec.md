## ADDED Requirements
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
