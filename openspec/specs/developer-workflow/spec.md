# developer-workflow Specification

## Purpose
Turn one project Developer prompt into an explainable, persistent sequence from intent analysis through specification review and isolated implementation with QA evidence.

## Requirements

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

### Requirement: Scoped follow-up context
A subsequent Developer prompt MAY reference earlier completed or stopped work. Clinic SHALL validate project and agent ownership and supply a bounded summary of that work to analysis. Follow-up context SHALL not bypass skill routing, spec validation, review or implementation isolation.
#### Scenario: Continue a completed conversation
- **WHEN** a user sends another prompt after a workflow finishes
- **THEN** analysis receives the previous prompt, outcome and relevant change together with the new request.
#### Scenario: Context belongs to another project or agent
- **WHEN** the caller supplies an unrelated workflow as context
- **THEN** Clinic rejects the request before starting provider work.

### Requirement: Durable stage clarification
Clinic SHALL resolve blocking product questions throughout specification and development while retaining workflow identity, evidence and partial work.

#### Scenario: Clarify at every development stage
- **WHEN** analysis, spec authoring, implementation or QA identifies unresolved product intent
- **THEN** the workflow persists focused questions with stage and revision context and pauses dependent work without declaring completion.

#### Scenario: Resume clarification without losing work
- **WHEN** the owner answers a pending question
- **THEN** the same workflow retains the full question history and resumes the affected stage; partial implementation remains available in its isolated workspace.

#### Scenario: Review requirements changed by answers
- **WHEN** an answer changes required behavior
- **THEN** Clinic proposes a reviewed spec revision, invalidates previous approval and QA and resumes implementation only against current approved requirements.

#### Scenario: Recover and protect pending questions
- **WHEN** a waiting workflow reloads or the service restarts, or an obsolete answer is submitted
- **THEN** pending questions remain available, stale answers are rejected and no approval, QA completion or finalization bypasses a blocking question.

#### Scenario: Avoid unnecessary clarification
- **WHEN** requirements are clear or a test exposes an ordinary implementation defect
- **THEN** the agent follows existing intent, records routine assumptions and does not ask the owner to decide a technical fix.
