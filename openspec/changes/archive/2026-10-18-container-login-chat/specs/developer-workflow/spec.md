## ADDED Requirements
### Requirement: Scoped follow-up context
A subsequent Developer prompt MAY reference earlier completed or stopped work. Clinic SHALL validate project and agent ownership and supply a bounded summary of that work to analysis. Follow-up context SHALL not bypass skill routing, spec validation, review or implementation isolation.
#### Scenario: Continue a completed conversation
- **WHEN** a user sends another prompt after a workflow finishes
- **THEN** analysis receives the previous prompt, outcome and relevant change together with the new request.
#### Scenario: Context belongs to another project or agent
- **WHEN** the caller supplies an unrelated workflow as context
- **THEN** Clinic rejects the request before starting provider work.
