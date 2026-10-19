## ADDED Requirements

### Requirement: Terminal setup projects in global GUI
Clinic SHALL register successfully configured terminal projects in the global GUI with accessible repository files, preserve existing registrations and mounts, and report incomplete registration separately from applied setup.

#### Scenario: Open a terminal-configured project in the GUI
- **WHEN** terminal setup applies successfully or confirms the project is already configured
- **THEN** the global GUI lists the project and its workspace can read its specifications, agents and skills without manual re-addition.

#### Scenario: Set up the same project again
- **WHEN** terminal setup succeeds for a previously registered canonical host path
- **THEN** the GUI reuses one project registration and existing project history remains available.

#### Scenario: Add a project outside current GUI mounts
- **WHEN** a successfully configured project is not accessible through the current GUI mounts
- **THEN** Clinic adds access to that specific project while preserving previous mounts and registrations, without exposing unrelated host directories.

#### Scenario: GUI registration cannot finish safely
- **WHEN** registration needs runtime recreation while agent work is active or waiting, or the GUI runtime is unavailable
- **THEN** setup files remain applied, registration stays pending with an actionable explanation, and sddclinic start can retry registration without rerunning analysis or interrupting agent work.

#### Scenario: Do not register declined setup
- **WHEN** setup is declined, canceled or fails before successful completion
- **THEN** Clinic does not create a new GUI registration for that attempt.
