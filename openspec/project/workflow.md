# Project SDD workflow

## Shared project context
Read mission.md, tech-stack.md and roadmap.md here, .clinic/project.yaml, repository instructions, accepted specs and relevant active changes. Preserve existing intent. Confirm unresolved scope with the owner; document low-impact assumptions without inventing product decisions.

## Feature folder
Use openspec/changes/<change>/ with research.md (sources and overlap decisions), proposal.md (why/scope), specs/<capability>/spec.md (requirements and scenarios), design.md (how and tradeoffs), validation.md (scenario-to-check plan), tasks.md (small verifiable slices), and .openspec.yaml. Native OpenSpec names avoid duplicate requirements.md/plan.md copies. Add contracts.md, data-model.md or a walkthrough only when their content helps this change; record applicability in design.

## Plan, implement, verify, replan
1. Analyze intent and search accepted/active requirements for overlap.
2. Research uncertain claims using repository evidence or primary sources, recording dates and uncertainty. No research needed is a valid conclusion when explained.
3. Create or refine the complete feature bundle. Every scenario needs a specific test/manual check and expected evidence in validation.md. Resolve blocking questions, review the diff, run strict validation and approve the revision.
4. Implement small task groups with their tests in an isolated workspace. Read the constitution and approved validation plan. Record outcomes at exact spec/code revisions; preserve the approved plan.
5. Independently verify scenarios, include UI/manual checks when relevant, and distinguish passed, failed and unverified. A checked task is not test evidence.
6. If implementation reveals a requirement gap, refine and reapprove; invalidate stale QA. Review the roadmap after each feature. Archive reviewed changes and verify integration before calling them Done.

## Existing applications
Inventory documentation, code, tests and telemetry first. Label inferred behavior for review, preserve custom instructions/schema/skills and split baseline capabilities by cohesive user behavior. Do not accept all existing bugs as intended requirements.

## Portable skills and evidence
Use analyze-request → create-spec/refine-spec → implement-spec with Codex or Claude. Tools and model-specific wrappers are separate from project intent. Test plans live with changes, run outcomes live in Clinic, historical artifacts remain in the archive. Never put credentials in specifications.

## Research basis
Adapted, with original templates, from [DeepLearning.AI course materials](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files), [OpenSpec workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md) and [Spec Kit interface contracts](https://github.com/github/spec-kit/blob/main/docs/guides/contract-driven-development.md). These are references, not commands to run or authority to merge/deploy. No single file count is a universal SDD requirement.
