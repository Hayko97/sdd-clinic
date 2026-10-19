# Design

## Overlap and scope
Extend spec-workspace reviewed setup. Reuse existing project-skills and developer-workflow requirements; their runtime routing already supplies analyze-request, refinement/creation and approved implementation. This change supplies persistent external-agent guidance and does not modify provider protocols, credentials, role permissions or runtime engine selection. See research.md for exact source references and overlap decisions.

## Instruction generation
Keep the supported paths and shared instruction text in a small server module used by setup, inspection and proposal path validation. Generate AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md and .cursor/rules/sdd-clinic.mdc regardless of selected engine. New Cursor rules include YAML frontmatter with alwaysApply: true. Preserve existing frontmatter as user configuration.

Each block tells agents to read project guidance, OpenSpec config/specs/active changes and canonical .clinic skills. Analyze each development request; refine only when existing intent needs improvement, create a named change for new behavior, avoid duplicate requirements, review/validate before implementing, and verify scenarios afterward. Read canonical skills directly where a native loader is absent. Respect planning-only and QA roles. Missing setup files require repairing setup before implementation. Keep instructions concise and all paths repository-relative.

## Preservation and upgrade
Continue using the existing managed markers. Append the block when neither marker exists. Replace an exact prior default block only when there is one well-formed pair of markers; recognize LF and CRLF without changing surrounding bytes. Retain customized, partial or duplicate marker blocks verbatim for manual review rather than risking deletion. Current content yields no proposal. Existing custom metadata remains authoritative, including a deliberately scoped Cursor rule. The README explains this limit and how to rerun setup.

## Review and write boundary
Use the existing setup proposal/application path and its exact file allowlist, safePath checks and before hashes. Do not allow arbitrary .github or .cursor configuration writes. Include the new files in bounded project inspection. No API or persisted-data changes are needed, so separate contracts.md and data-model.md are unnecessary. A separate UI walkthrough document is unnecessary; browser setup verification and docs/verification.md provide evidence.

## Delivery and risks
User requested implementation of this workflow. Review the complete artifacts and strict validation before editing behavior; preserve existing approval stages in Clinic. This checkout has no HEAD, so preserve the uncommitted working tree and report the lack of isolated self-implementation/Git integration. Verify setup fixtures and the browser diff, run pnpm check and pnpm test:e2e, adopt through the setup machinery in Clinic itself and rebuild Docker Compose. Instruction files cannot guarantee arbitrary external agent compliance. Live inference remains opt-in.
