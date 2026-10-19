## ADDED Requirements

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
Clinic SHALL store secrets in the OS credential store or session memory and exclude them from agent prompts, project files, and evidence.

#### Scenario: Persistent secret storage is unavailable
- **WHEN** persistent secret storage is unavailable
- **THEN** Clinic labels the connection session-only and requires re-entry after restart.

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
