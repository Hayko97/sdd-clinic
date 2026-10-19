# agent-scheduling Specification

## Purpose
Allow each project's configured agents to run optional saved tasks on a predictable schedule with project isolation and visible execution outcomes.

## Requirements

### Requirement: Project agent schedules
Each project SHALL own schedule definitions containing agent, saved prompt or QA target, interval and enabled state. Schedules SHALL default to disabled and expose next execution and last outcome in the project workspace. Developer schedules SHALL use the same prompt pipeline and spec approval gate as manual requests.
#### Scenario: Configure a schedule
- **WHEN** a user enables a project's agent schedule
- **THEN** future occurrences use that project's agent and saved task, while other projects remain unaffected.
#### Scenario: Invalid agent or QA target
- **WHEN** a schedule references an absent agent or QA lacks a target change
- **THEN** saving it fails with an actionable validation error.

### Requirement: Bounded schedule dispatch
Clinic SHALL dispatch only while running, record skipped missed intervals after restart, and prevent overlapping occurrences for an agent already running or awaiting workflow review. Each occurrence SHALL record success, error or skip without retrying a backlog. Schedule errors SHALL remain visible.
#### Scenario: Restart after missed intervals
- **WHEN** Clinic starts after scheduled times were missed
- **THEN** it records missed occurrences and sets the next future execution without catch-up runs.
#### Scenario: Agent already has work
- **WHEN** a scheduled occurrence finds active work or an approval-waiting workflow for that agent
- **THEN** it records a skip rather than starting duplicate work.
