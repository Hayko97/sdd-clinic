## ADDED Requirements

### Requirement: Configurable roles
Clinic SHALL provide Developer, QA, and PO defaults and allow role instructions, engine, model, tools, limits, and triggers to be edited or duplicated.

#### Scenario: An agent definition changes on disk
- **WHEN** an agent definition changes on disk
- **THEN** Clinic reads the updated definition for the next run.

### Requirement: Isolated implementation
Clinic SHALL implement an approved change in its own Git worktree from a committed baseline plus approved spec files.

#### Scenario: The source checkout contains unrelated uncommitted work
- **WHEN** the source checkout contains unrelated uncommitted work
- **THEN** The implementation neither modifies nor silently includes that work.

### Requirement: Independent QA
Clinic SHALL automatically run QA against the frozen implementation revision and report passed, failed, or unverified checks.

#### Scenario: A required test cannot run
- **WHEN** a required test cannot run
- **THEN** QA reports the missing environment as unverified rather than passing.

### Requirement: Evidence-bound review
Clinic SHALL bind QA and review to exact spec and code revisions.

#### Scenario: The implementation changes after QA
- **WHEN** the implementation changes after qa
- **THEN** Finalization is blocked pending another QA run.

#### Scenario: The user requests QA after a manual implementation commit
- **WHEN** the implementation workspace is clean and contains a new commit with unchanged approved requirements
- **THEN** Clinic freezes that commit for a new QA run and invalidates the earlier QA result.

### Requirement: Reviewable implementation diff
Clinic SHALL show the implementation branch, changed files, and diff against its selected committed baseline.

#### Scenario: The user reviews an implementation
- **WHEN** the user opens the implementation review
- **THEN** Clinic displays its branch, commit, working directory, changed files, diff, and whether its QA evidence is current.

### Requirement: Integration tracking
Clinic SHALL archive and synchronize accepted OpenSpec changes on the implementation branch and mark Done only after verified integration.

#### Scenario: The change is finalized but not merged
- **WHEN** the change is finalized but not merged
- **THEN** Clinic shows Ready to integrate and does not push or merge automatically.
