## ADDED Requirements

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
