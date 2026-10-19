## ADDED Requirements
### Requirement: Developer operations use project skills
Clinic SHALL expose a primary Run prompt workflow and optional Create spec, Refine spec and Implement spec operations for the Developer agent. Creation SHALL use create-spec and refinement SHALL use refine-spec from the selected project; implementation SHALL use its implement-spec skill. The operation, project, target change and skill SHALL be visible before execution. Ambiguous intended behavior SHALL be clarified before implementation.

#### Scenario: Create a specification with Developer
- **WHEN** the user selects Create spec and describes intended behavior
- **THEN** Developer uses create-spec to inspect relevant accepted specs and active changes, explain overlapping requirements, and return a reviewable proposal, design, scenarios and test-linked tasks without modifying application code.

#### Scenario: Refine an existing specification
- **WHEN** the user selects Refine spec and a current spec or active proposal
- **THEN** Developer uses refine-spec to propose only necessary requirement changes, targets an existing active proposal when selected, and otherwise creates a delta against the accepted spec rather than overwriting it.

#### Scenario: Existing requirements already satisfy the request
- **WHEN** creation or refinement finds equivalent existing requirements with no necessary change
- **THEN** Developer identifies the matching requirements and explains the no-change result without creating duplicate requirements or an empty proposal.

#### Scenario: Operation intent is ambiguous
- **WHEN** a prompt leaves intended behavior or its target project unclear
- **THEN** Clinic asks for the missing behavior or target while preserving the request and context, and does not guess a mutating action.

### Requirement: Developer handoff preserves approved intent
Developer SHALL start Implement spec only for a validated change whose current revision is approved and whose implementation is explicitly requested. Every pass SHALL use implement-spec, run relevant tests and specification validation, and report evidence or unverified criteria. Existing isolated-workspace, independent-QA and integration requirements SHALL remain in effect.

#### Scenario: Implement the approved specification
- **WHEN** the user requests Implement spec for a current approved revision
- **THEN** Developer uses implement-spec in the assigned isolated workspace, links tests and validation evidence to that revision, and hands the frozen implementation to independent QA.

#### Scenario: Implementation is requested for a stale or draft specification
- **WHEN** the target change has not passed validation or its current revision is not approved
- **THEN** Clinic prevents implementation and identifies the validation, refinement or approval step needed without discarding the user's request.

#### Scenario: Implementation reveals a requirement change
- **WHEN** Developer discovers that the requested implementation needs behavior outside the approved requirements
- **THEN** it preserves partial implementation work, reports the gap and offers refinement using refine-spec; further implementation of changed behavior waits for review and approval of the revised requirements.

#### Scenario: Tests or validation cannot complete
- **WHEN** an implementation pass cannot run a required test or specification validation
- **THEN** the run reports the missing evidence as failed or unverified as appropriate and does not claim verified completion.

#### Scenario: Current implementation is already verified
- **WHEN** the requested change already has passing QA evidence for the current specification and code revisions
- **THEN** Developer surfaces that evidence and offers review or a new refinement instead of silently implementing the same change again.

#### Scenario: Default instructions are updated on a customized project
- **WHEN** a project with customized Developer instructions adopts the skill-driven workflow
- **THEN** Clinic preserves the customization and presents any required instruction updates for review rather than replacing the file silently.


### Requirement: Project-owned agents and CLI selection
Each project SHALL own its agent definitions, prompts and schedules. Agents SHALL use the project's configured Codex or Claude connection unless an explicit agent override is configured. The resolved engine and model SHALL be visible before dispatch and recorded with the run. A missing or unauthenticated connection SHALL block dispatch with actionable guidance, without silently switching providers.

#### Scenario: Two projects configure different developer agents
- **WHEN** one project uses Codex and another uses Claude with different instructions and schedules
- **THEN** each project's Developer runs with its own configuration and changes to one project's agent do not change the other.

#### Scenario: Configured provider is unavailable
- **WHEN** a manual or scheduled prompt cannot use its resolved CLI connection
- **THEN** Clinic retains the prompt, records the connection failure and offers setup or retry instructions without dispatching to a different engine.

### Requirement: Prompt-to-implementation workflow
For each prompt, Clinic SHALL review existing specs and changes using create-spec for new intent or refine-spec for an existing target, propose only necessary deltas, then use implement-spec for the validated, approved revision. Run prompt SHALL express implementation intent; approving required spec changes SHALL continue that workflow without re-entering the prompt. Spec-only actions SHALL stop after authoring.

#### Scenario: Prompt needs a new or refined requirement
- **WHEN** the Developer review finds behavior not covered by current requirements
- **THEN** it creates or refines a proposal with scenarios and test-linked tasks, presents the diff for approval, and continues the same workflow into isolated implementation after approval.

#### Scenario: Existing specification covers the prompt
- **WHEN** existing approved requirements fully cover the prompt but current implementation lacks verified evidence
- **THEN** Developer reuses the matching requirements without duplicate specs and implements or verifies the identified gap; if no active approved change exists, Clinic prepares a traceable implementation change referencing those requirements for review.

#### Scenario: Prompt requests already verified behavior
- **WHEN** current revision-bound evidence shows the requested behavior is implemented and verified
- **THEN** Developer returns the matching requirements and evidence as a no-op result rather than creating unnecessary specs or code changes.

#### Scenario: Prompt is awaiting approval
- **WHEN** the workflow requires approval of new or revised requirements
- **THEN** Clinic shows Awaiting spec approval with the proposed diff and original prompt, preserves its state across restart, and does not treat a schedule trigger as approval.

#### Scenario: Resume or cancel the workflow
- **WHEN** a prompt workflow is interrupted, canceled or resumed
- **THEN** Clinic preserves its prompt, project, change and stage evidence, never automatically repeats completed mutations after restart, and requires explicit resume for interrupted work.

### Requirement: Per-project agent schedules
Clinic SHALL let users configure multiple schedules per project agent with a saved prompt, interval, enabled state and visible next/last execution. Schedules SHALL be disabled by default and execute only while Clinic runs. Each occurrence SHALL retain its project, agent and prompt revision. Missed intervals SHALL be recorded without catch-up execution. A schedule SHALL not grant permissions beyond a manual run.

#### Scenario: Configure a Developer schedule
- **WHEN** the user saves and explicitly enables a schedule for one project's Developer agent
- **THEN** the GUI shows its saved prompt and next execution, and the due occurrence uses that project's configured CLI and prompt-to-implementation workflow.

#### Scenario: Disable or edit a schedule
- **WHEN** the user disables or edits a schedule
- **THEN** future occurrences use the updated configuration or stop, while existing runs preserve their captured configuration and remain explicitly cancellable.

#### Scenario: Another occurrence is due while work is active
- **WHEN** the same agent already has an active or approval-waiting scheduled workflow, or its target change has an implementation writer
- **THEN** Clinic records the occurrence as skipped due to active work rather than launching a competing writer or duplicate approval request.

#### Scenario: Service restarts after scheduled times
- **WHEN** Clinic restarts after one or more occurrences were missed
- **THEN** it records missed occurrences, calculates the next future run, and does not replay missed prompts or resume interrupted work automatically.

#### Scenario: Migrate existing PO scheduling
- **WHEN** an existing project with a PO schedule adopts per-agent schedules
- **THEN** its enabled state, cadence and reviewed-metric restrictions are preserved under its PO agent and only one timer dispatches each occurrence.
