## ADDED Requirements

### Requirement: Portable agent development instructions
Reviewed setup SHALL provide native project instruction files for Codex, Claude, Gemini CLI, GitHub Copilot and Cursor, plus shared guidance for AGENTS.md-compatible agents. The guidance SHALL direct each development request through specification analysis, needed refinement or creation, review, implementation and verification using authoritative project skills. Setup SHALL preserve custom instructions and upgrade only recognized unchanged Clinic defaults.

#### Scenario: Review portable instructions during setup
- **WHEN** a project without agent guidance is inspected for setup with either supported engine
- **THEN** the setup diff includes AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md and an always-applied Cursor project rule, and no file is written before applying the proposal.

#### Scenario: Route every development request through specifications
- **WHEN** an agent reads generated project guidance before a development request
- **THEN** the guidance requires reading project context and analyzing accepted specs and active changes, refining unclear or changed existing intent, creating specifications for new intent, and implementing only after the relevant review and validation; unchanged matching specs are reused without forced edits, and scenario evidence is required after implementation.

#### Scenario: Upgrade an existing Clinic instruction block
- **WHEN** setup finds the exact previous default instruction block surrounded by project-specific instructions
- **THEN** it proposes replacement of only that block with the complete workflow and preserves the surrounding instructions.

#### Scenario: Preserve custom instructions and repeat setup
- **WHEN** setup finds custom instructions, a customized managed block or existing tool metadata and is subsequently repeated after application
- **THEN** custom content and metadata remain intact, missing guidance is appended where no managed block exists, and the repeated setup proposes no duplicate or unchanged files.

#### Scenario: Reject stale instruction updates
- **WHEN** any proposed instruction file changes before the setup proposal is applied
- **THEN** the whole setup proposal is rejected before writes and the external edit remains intact.

#### Scenario: Refuse unsafe instruction targets
- **WHEN** a setup instruction target traverses a symbolic link or a proposal attempts an unsupported tool configuration path
- **THEN** setup rejects the target without writing outside the allowed project instruction files.
