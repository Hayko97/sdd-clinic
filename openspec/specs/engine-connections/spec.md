# engine-connections Specification

## Purpose
Connect installed coding CLIs through supported provider workflows and expose persistent conversations, diagnostics, streaming events, approvals, and interruption through one local interface.

## Requirements

### Requirement: CLI-first connection
Clinic SHALL discover Codex and Claude executables, support a custom path, and report version, capabilities, and authentication separately. Guidance SHALL identify the runtime in which authentication is needed. Unknown or absent authentication SHALL not be shown as Connected.
#### Scenario: A missing executable is selected
- **WHEN** a missing executable is selected
- **THEN** Clinic displays installation guidance without claiming a successful connection.
#### Scenario: Login instructions are shown inside Docker
- **WHEN** a containerized CLI lacks authentication
- **THEN** guidance uses the container's provider workflow and explains that host sign-in is separate.

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

### Requirement: Runtime-owned Codex sign-in
Clinic SHALL offer supported Codex device-code sign-in in the same environment as its engine processes. It SHALL show the provider verification link/code, waiting status and cancellation, and confirm authentication before marking Connected. Tokens SHALL remain with the provider; sign-in codes SHALL not enter repository files or durable application logs.
#### Scenario: Codex is installed but Docker is unsigned
- **WHEN** the user starts sign-in for the container's Codex executable
- **THEN** Clinic presents the provider's device-code challenge and updates connection state after successful sign-in without a host-terminal callback.
#### Scenario: Sign-in fails, expires or is canceled
- **WHEN** the provider fails, a pending attempt exceeds its lifetime, or the user cancels
- **THEN** Clinic stops the pending login, clears its one-time code and shows an actionable retry state without claiming authentication.
#### Scenario: Duplicate sign-in or changed executable
- **WHEN** a login attempt is already active
- **THEN** Clinic rejects another start or a connection-path change until that attempt completes or is canceled.
#### Scenario: Service restarts during sign-in
- **WHEN** Clinic restarts with unfinished sign-in
- **THEN** no old device challenge is replayed and the user can explicitly start again.
