# Research

Reviewed 2026-10-18.

## Repository evidence and overlap
- src/server/projects.ts already proposes AGENTS.md and CLAUDE.md with a marker-delimited one-paragraph default. Existing markers prevent upgrades.
- src/server/specs.ts restricts setup paths and rejects stale proposals before writes. Reuse this boundary for the additional exact paths.
- spec-workspace owns reviewed setup and conflict-safe editing; add portable instructions there. project-skills already owns canonical analyze-request/create-spec/refine-spec/implement-spec behavior. developer-workflow already enforces the in-app pipeline. Reuse these capabilities without creating a competing skill or pipeline.
- No active changes existed when this change was opened. Historical documentation-kit and project-workspace-flow changes establish safe stock upgrades and the current pipeline.

## Primary sources
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md): root AGENTS.md is discovered; overrides and configured fallbacks can affect loading.
- [Claude project memory](https://code.claude.com/docs/en/memory): CLAUDE.md supplies project instructions; instructions guide behavior rather than enforcing tool permissions.
- [Gemini context](https://geminicli.com/docs/cli/gemini-md/): GEMINI.md is the default project context filename.
- [GitHub repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions): .github/copilot-instructions.md supplies repository-wide instructions.
- [Cursor rules](https://cursor.com/docs/rules): .cursor/rules/*.mdc with alwaysApply: true supplies instructions for each chat.

## Decisions and limits
Use native filenames, not a literal lowercase agent.md that tools may ignore. Cover the named engines plus three common additional tools; AGENTS.md remains the fallback for compatible tools. Repeat the same short workflow in each generated block so no provider-specific import syntax is required. Canonical skills remain in .clinic/skills/ and can be read directly when a tool has no skill loader. Preserve customized blocks instead of guessing whether they are safe to rewrite. Live agent compliance, user overrides and disabled instruction loading cannot be proved by file-generation fixtures and are not claimed.
