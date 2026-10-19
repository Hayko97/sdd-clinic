# Validation plan

## Scenario coverage
| Scenario | Check / procedure | Expected evidence |
| --- | --- | --- |
| Inspect an established capability | tests/workspace.test.ts and tests/e2e/workspace.spec.ts: guidance, archives, counts, mobile | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Browse project guidance | tests/workspace.test.ts and tests/e2e/workspace.spec.ts: guidance, archives, counts, mobile | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Supporting files and project separation | tests/workspace.test.ts and tests/e2e/workspace.spec.ts: guidance, archives, counts, mobile | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Narrow document navigation | tests/workspace.test.ts and tests/e2e/workspace.spec.ts: guidance, archives, counts, mobile | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Author a feature | tests/documentation.test.ts and tests/workflows.test.ts: stock upgrade, prompt context and delivery | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Update unchanged default skills | tests/documentation.test.ts and tests/workflows.test.ts: stock upgrade, prompt context and delivery | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Verify an implementation | tests/documentation.test.ts and tests/workflows.test.ts: stock upgrade, prompt context and delivery | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Initialize project guidance | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Adopt an existing project | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Project guidance changes after approval | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Create a new change | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Incomplete validation plan | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Existing external workflow | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |
| Edit shared project guidance | tests/documentation.test.ts: setup/schema/scaffold/coverage/context/edit cases | Observe the exact WHEN/THEN result in this scenario; inspect assertions and rendered UI as applicable |

## Integration commands
- pnpm check: TypeScript, unit/integration suites, strict OpenSpec validation and production build.
- pnpm test:e2e: all browser workflows, including project guidance edits, reviewed complete drafts and archived documents.
- Pinned openspec schema validate/status/instructions: integration tests exercise actual CLI output for clinic-sdd.
- Skill Creator quick_validate.py on all four canonical project skills.

## Docker walkthrough
Open the current private launch URL. Verify the Projects grid still counts ten capabilities, open SDD Clinic, read all four guidance documents, expand a capability and inspect its three current files plus related historical bundles. Check desktop and 375px layouts. Review a new complete feature proposal in disposable browser fixtures; do not create test changes or credentials in the user's project.

## Evidence and limitations
Store observed outcomes and revision digests in docs/verification.md. This plan defines checks, not results. Live provider inference, external infrastructure and semantic quality of live model authoring remain separately unverified. Course transcripts were inaccessible; research cites the official published artifacts instead. No Git integration is claimed for this checkout without an initial commit.
