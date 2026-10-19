## MODIFIED Requirements

### Requirement: Revision approval
Clinic SHALL validate and hash approved change artifacts before implementation. New capabilities SHALL include a meaningful purpose that can be preserved in accepted specifications.

#### Scenario: An approved artifact changes
- **WHEN** an approved artifact changes
- **THEN** Its approval and dependent QA result are invalidated until the new revision is approved.

#### Scenario: A new capability has no meaningful purpose
- **WHEN** a change introducing a new capability is submitted for approval without a purpose or with a placeholder
- **THEN** Clinic rejects approval and explains that a meaningful Purpose section is required before implementation.
