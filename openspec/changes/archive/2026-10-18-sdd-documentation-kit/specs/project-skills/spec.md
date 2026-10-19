## ADDED Requirements

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
