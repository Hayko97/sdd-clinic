## MODIFIED Requirements
### Requirement: OpenSpec navigation
Clinic SHALL list current specs, proposed changes, and archives from repository files with search and rendered Markdown. Search SHALL be scoped to the selected project and match case-insensitive document names, paths and content within the active current/proposed/archive filter. Results SHALL identify the document's path and kind so the user can select the intended spec before requesting changes.

#### Scenario: A file changes outside Clinic
- **WHEN** a file changes outside clinic
- **THEN** The next refresh shows the file and outstanding edits retain their original base revision.

#### Scenario: Find requirements in the selected project
- **WHEN** the user searches for a phrase contained in a specification
- **THEN** matching documents from the selected project and selected category are shown, and selecting a result displays its content and attaches the selected document to subsequent prompts.

#### Scenario: Search has no matches
- **WHEN** no document matches the search and active category
- **THEN** Clinic shows an explicit no-results state and a way to clear the search without creating a spec automatically.

#### Scenario: Search across project boundaries
- **WHEN** two projects contain similar requirements and the user searches in one project
- **THEN** results and attached context contain only that project's documents, and opening another project clears the prior search and document selection.
