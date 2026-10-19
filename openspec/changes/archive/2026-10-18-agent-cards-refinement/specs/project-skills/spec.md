## MODIFIED Requirements
### Requirement: Project default skills
Clinic SHALL propose default create-spec, refine-spec and implement-spec skills during setup, preserve existing skill files, and expose installed skills for the selected project.
#### Scenario: Customized project is set up again
- **WHEN** setup is repeated after a skill is customized
- **THEN** customization is preserved and no duplicate skill is created.
#### Scenario: Project selection changes
- **WHEN** another project is selected
- **THEN** only that project's skills are displayed and used.

#### Scenario: Refine an existing specification
- **WHEN** a user prompts against an existing spec or continues an existing change conversation
- **THEN** Clinic loads that project's refine-spec skill and records its selection; if missing, it asks the user to run project setup before dispatching the conversation.

