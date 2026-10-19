# project-skills Specification

## Purpose
Give every project reusable skills for creating nonduplicative specifications and implementing them with test evidence, visible through a Docker-hosted Clinic workspace.

## Requirements

### Requirement: Project default skills
Clinic SHALL propose default analyze-request, create-spec, refine-spec and implement-spec skills during setup, preserve existing skill files, and expose installed skills for the selected project.
#### Scenario: Customized project is set up again
- **WHEN** setup is repeated after a skill is customized
- **THEN** customization is preserved and no duplicate skill is created.
#### Scenario: Project selection changes
- **WHEN** another project is selected
- **THEN** only that project's skills are displayed and used.

#### Scenario: Refine an existing specification
- **WHEN** a user prompts against an existing spec or continues an existing change conversation
- **THEN** Clinic loads that project's refine-spec skill and records its selection; if missing, it asks the user to run project setup before dispatching the conversation.

### Requirement: Complete specification workflow
The creation skill SHALL review accepted specs and active changes for overlapping intent, reuse existing capabilities where appropriate, record overlap decisions, and define proposal, scenarios, design and test-linked tasks before implementation.
#### Scenario: Requested behavior already exists
- **WHEN** spec creation identifies an existing equivalent requirement
- **THEN** the agent explains the match and proposes only necessary deltas rather than duplicating the requirement.

### Requirement: Evidence-aware implementation
The implementation skill SHALL require tests and specification validation on every implementation pass. Clinic SHALL distinguish absent implementation, implementation awaiting verification, and implementation with current passing QA evidence.
#### Scenario: Implementation has no passing current evidence
- **WHEN** code exists without current successful QA
- **THEN** Clinic labels it unverified instead of implemented and verified.

### Requirement: Container runtime
Clinic SHALL provide Docker Compose as its default runtime with persistent application state, explicit repository access, and host-loopback browser access.
#### Scenario: Container restarts
- **WHEN** Clinic restarts with the same persistent volume
- **THEN** project registrations and execution history remain available.

### Requirement: Research-informed reusable SDD workflow
Default project skills SHALL use project guidance, duplicate-intent review, source-backed research, testable requirements, design decisions, scenario-linked validation and small verifiable task groups. They SHALL distinguish planned validation from observed results and retain human review before implementation.
#### Scenario: Author a feature
- **WHEN** the Developer creates or refines a feature
- **THEN** its prompt includes the project guidance and artifact requirements, and skills direct it to record sources, assumptions, relevant interfaces and validation coverage without duplicating accepted requirements.
#### Scenario: Update unchanged default skills
- **WHEN** setup encounters a previous unmodified default skill
- **THEN** it proposes the new default for review while preserving any customized skill verbatim.
#### Scenario: Verify an implementation
- **WHEN** the Developer implements an approved change
- **THEN** its instructions require the validation plan and scenario evidence, and missing environments remain unverified rather than being reported as passed.
