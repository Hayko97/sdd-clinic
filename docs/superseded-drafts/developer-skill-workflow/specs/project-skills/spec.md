## ADDED Requirements
### Requirement: Authoritative skills for Developer operations
Clinic SHALL resolve Developer skills from the selected project's authoritative skill files at operation start. Runs SHALL record the skill name, project-relative path and content revision used, and expose this information with their context. Provider discovery entrypoints SHALL not replace the authoritative content. Missing, invalid or unreadable required skills SHALL prevent that operation until resolved.

#### Scenario: Customized project skill is used
- **WHEN** Developer starts an operation after the project's relevant skill was customized
- **THEN** the operation receives that project's current skill instructions and records their revision, rather than using a bundled default or another project's skill.

#### Scenario: Skill changes during a run
- **WHEN** the skill file is edited after an operation starts
- **THEN** that operation remains attributable to its captured skill revision and the next operation loads the updated file.

#### Scenario: Required skill is missing or invalid
- **WHEN** Developer is asked to create, refine or implement a spec but its required skill cannot be loaded as a valid skill
- **THEN** Clinic explains which skill needs attention and offers reviewed setup for missing defaults or a repair path for invalid existing files, without silently bypassing the skill or overwriting customization.

#### Scenario: Project selection changes
- **WHEN** the user starts Developer in another project
- **THEN** skill resolution and attached specification context use only that project and existing runs retain their original project association.
