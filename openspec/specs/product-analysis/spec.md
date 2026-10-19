# product-analysis Specification

## Purpose
Connect product intent to bounded read-only data and server evidence, producing explainable findings and reviewed improvement proposals while keeping credentials isolated.

## Requirements

### Requirement: Read-only data connections
Clinic SHALL support PostgreSQL, MySQL, MongoDB, and SQLite through bounded read-only broker operations.

#### Scenario: An agent attempts a write, multiple SQL statements, or a write aggregation stage
- **WHEN** an agent attempts a write, multiple sql statements, or a write aggregation stage
- **THEN** The broker rejects the operation before execution.

### Requirement: Restricted server evidence
Clinic SHALL read permitted server paths via SFTP and support pinned-host SSH database tunnels without an unrestricted remote shell.

#### Scenario: A requested path escapes permitted roots or a host key differs
- **WHEN** a requested path escapes permitted roots or a host key differs
- **THEN** The connection broker rejects access.

### Requirement: Credential separation
Clinic SHALL persist secrets in the OS credential store or an encrypted local application vault, and exclude them from agent prompts, browser draft storage, transcripts, project files and evidence. If persistence is unavailable it SHALL clearly label session-only storage.
#### Scenario: Docker restarts without an OS keyring
- **WHEN** a saved connection uses the encrypted application vault and its persistent volume remains available
- **THEN** its credentials can be used after restart without being exposed in connection metadata.
#### Scenario: Persistent secret storage is unavailable
- **WHEN** neither credential store can persist the secret
- **THEN** Clinic labels it session-only and requires re-entry after restart.
#### Scenario: Encrypted credentials are damaged
- **WHEN** a stored credential cannot be authenticated or decrypted
- **THEN** Clinic reports that credentials must be re-entered and never returns unverified plaintext.

### Requirement: Evidence-backed findings
Clinic SHALL require feature, evidence references, observation time, expected behavior, uncertainty, suggested action, and priority rationale for findings.

#### Scenario: Data shows an anomaly without proven incorrect behavior
- **WHEN** data shows an anomaly without proven incorrect behavior
- **THEN** PO records an investigation candidate rather than a confirmed bug.

### Requirement: Metric review and deduplication
Clinic SHALL require reviewed metric mappings for recurring analysis and deduplicate findings by project and fingerprint.

#### Scenario: A scheduled analysis rediscovers an existing finding
- **WHEN** a scheduled analysis rediscovers an existing finding
- **THEN** Clinic updates its evidence instead of opening a duplicate.

### Requirement: Optional schedules
Clinic SHALL keep schedules disabled by default and run them only while the service is available.

#### Scenario: The service starts after scheduled times were missed
- **WHEN** the service starts after scheduled times were missed
- **THEN** Clinic records the skipped interval and schedules the next run without catch-up execution.

### Requirement: Connection prompt import
Clinic SHALL accept supported connection URLs, SSH commands and credential blocks from project chat, parse them locally and save them for a selected project agent. Save SHALL report configuration separately from connectivity. Unsupported or incomplete input SHALL receive actionable guidance without echoing secrets.
#### Scenario: Paste and save a database connection
- **WHEN** a user submits supported connection details and selects an agent
- **THEN** Clinic saves the profile and credential separately, shows only a non-secret receipt and exposes that source to the selected agent.
#### Scenario: Update an existing connection
- **WHEN** the user supplies replacement credentials for an existing project connection
- **THEN** Clinic updates that connection without creating a duplicate or exposing the prior secret.
#### Scenario: Unsupported or ambiguous input
- **WHEN** input cannot identify one supported connection
- **THEN** Clinic explains supported formats and does not save or send the input to a model.

### Requirement: Agent-scoped data access
Clinic SHALL make saved connections usable only by explicitly assigned project agents through bounded broker tools. Existing unassigned connections SHALL remain PO-only. Test results and failures SHALL be visible without exposing credentials.
#### Scenario: Assigned Developer inspects data
- **WHEN** a Developer is explicitly assigned a connection and invokes a data tool
- **THEN** the broker permits bounded read-only operations without giving credentials to the model or worktree.
#### Scenario: Another agent or project requests access
- **WHEN** an unassigned agent or another project requests a connection
- **THEN** Clinic denies the operation before contacting the remote service.
#### Scenario: SSH access settings are incomplete
- **WHEN** saved SSH details lack the verified fingerprint or permitted paths required by an operation
- **THEN** the operation reports which setting is missing without bypassing host verification or path restrictions.
