## Purpose
Turn one project Developer prompt into an explainable, persistent sequence from intent analysis through specification review and isolated implementation with QA evidence.
## ADDED Requirements
### Requirement: Skill-driven prompt pipeline
Developer SHALL use the configured project or agent CLI and run analyze-request before choosing create-spec or refine-spec. It SHALL reuse matching requirements, ask for unresolved intent, and record the skill revisions used. All authoring SHALL remain proposal-only. Application implementation SHALL use implement-spec only for a validated approved revision.
#### Scenario: Prompt needs changed behavior
- **WHEN** analysis identifies missing or changed requirements
- **THEN** Developer proposes complete OpenSpec artifacts and shows a diff for review without editing application code.
#### Scenario: Prompt matches an approved change
- **WHEN** analysis identifies an unchanged approved change ready for implementation
- **THEN** the same prompt workflow proceeds to isolated implementation and automatic QA without another prompt.
#### Scenario: Analysis needs clarification
- **WHEN** required intent is ambiguous
- **THEN** Clinic stores questions and the original prompt and accepts an answer before continuing analysis.
#### Scenario: Required skill or CLI is unavailable
- **WHEN** the operation cannot load a required project skill or connect to its configured CLI
- **THEN** it explains the problem and does not silently switch provider or skip the skill.
### Requirement: Durable reviewed continuation
Clinic SHALL retain workflow identity, prompt, agent, stage and related run/proposal/change IDs. Continuing a reviewed workflow SHALL apply only its unchanged proposal, validate and approve its current artifacts, then implement. Failures and restart interruptions SHALL preserve partial work without replaying mutations automatically.
#### Scenario: Review and continue
- **WHEN** the user approves the displayed proposal and chooses continue
- **THEN** Clinic validates the same change and starts implementation once; duplicate concurrent continuation is rejected.
#### Scenario: Restart or cancellation
- **WHEN** a workflow is interrupted or canceled
- **THEN** Clinic preserves its evidence and workspaces and requires explicit retry for interrupted work.
#### Scenario: Tests are unavailable
- **WHEN** implementation cannot verify a required check
- **THEN** the workflow reports failed or unverified QA rather than completed verified behavior.
