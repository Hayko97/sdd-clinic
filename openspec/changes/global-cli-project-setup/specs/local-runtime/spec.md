## ADDED Requirements

### Requirement: Global terminal entrypoint
Clinic SHALL provide a globally installable sddclinic entrypoint that can launch project setup from outside its source checkout while retaining the existing sdd-clinic start and doctor interface.

#### Scenario: Run setup after global installation
- **WHEN** a user installs a locally built package globally and invokes sddclinic setup from an existing project
- **THEN** the command is available, targets that project and uses the packaged Docker runtime without requiring the Clinic source working directory.

#### Scenario: Retain existing CLI usage
- **WHEN** a user invokes sdd-clinic start, doctor or --help after installing the package
- **THEN** the existing supported interface remains available.

#### Scenario: Report unavailable runtime prerequisites
- **WHEN** setup cannot access Docker or a valid target directory
- **THEN** it exits with an actionable diagnostic before provider analysis or project writes.

#### Scenario: Preserve an existing browser mount
- **WHEN** terminal setup targets a different repository while the browser runtime is running
- **THEN** the browser runtime mount and registrations remain unchanged and terminal runtime state separation is explained.
