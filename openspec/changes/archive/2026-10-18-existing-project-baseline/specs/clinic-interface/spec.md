## ADDED Requirements

### Requirement: Existing project setup analysis review
Clinic SHALL offer comprehensive project analysis during setup, display durable progress and coverage, and make the resulting specification/agent-file diff reviewable before application. Provider-free setup SHALL remain available and explicitly indicate that semantic analysis has not run.

#### Scenario: Follow and review setup analysis
- **WHEN** setup starts with the project's configured CLI connected
- **THEN** the user can follow and stop analysis, return after reload, review its coverage and inferred specs together with agent files, and apply the proposal to expose the new capabilities in the workspace.

#### Scenario: Set up files without a provider
- **WHEN** setup runs without a connected configured CLI or the user selects files-only setup
- **THEN** Clinic offers local instruction/skill/document installation, clearly says source-derived specs were not generated, and keeps project analysis available after connecting a CLI.
