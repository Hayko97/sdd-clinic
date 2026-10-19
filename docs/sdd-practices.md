# SDD practices used by Clinic

Research date: 2026-10-18. This is an original analysis and implementation guide, not a transcript or reproduction of course materials.

## What was reviewed

The requested [DeepLearning.AI lesson](https://learn.deeplearning.ai/courses/spec-driven-development-with-coding-agents/lesson/8bhg0p/introduction) returned HTTP 403. The public video fetch was also unavailable. **The complete lesson transcripts were not accessible and have not been reviewed.** No authentication or access restriction was bypassed.

Reviewed the public course description, the [official companion repository](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files) at commit `4a9c2ac8cdac38a6689b65512461dde614487650`, all ten published prompt files and the feature-spec/changelog skills; inspected the structure and selected sections of the mission/technology examples. These are the published exercises and workflow artifacts, not a substitute claim of viewing every video.

| Course area | Primary material reviewed | Application in Clinic |
| --- | --- | --- |
| Introduction, motivation, workflow and environment | [Public course overview](https://www.deeplearning.ai/courses/spec-driven-development-with-coding-agents/) and repository overview | Persistent project intent; portable workflow across Codex and Claude. Detailed transcript coverage unavailable. |
| Constitution | [Lesson 04 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_04_prompts.md), example_specs | Separate mission, stack constraints and a small-step roadmap. Label inferred intent for review. |
| Feature specification | [Lesson 05 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_05_prompts.md) | One feature folder with requirements, plan and validation responsibilities. Preserve OpenSpec's native names. |
| Implementation | [Lesson 06 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_06_prompts.md) | Execute the reviewed task groups rather than interpreting a disconnected chat request. |
| Validation | [Lesson 07 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_07_prompts.md) | Keep observed behavior and requirements consistent; review completion evidence. Clinic retains its existing manual integration boundary. |
| Replanning | [Lesson 08 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_08_prompts.md) | Revise shared constraints and affected feature plans when testing or UI requirements change. |
| Second feature | [Lesson 09 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_09_prompts.md) | Reuse project conventions, review implementation and rerun relevant checks. |
| MVP | [Lesson 10 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_10_prompts.md) | Reconcile gaps discovered during implementation with the roadmap and specifications. |
| Legacy projects | [Lesson 11 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_11_prompts.md) | Inspect existing documents/code, record unknowns and preserve custom setup. Observed code is not automatically approved intent. |
| Custom workflow | [Lesson 12 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_12_prompts.md), [feature skill](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/skills/feature-spec/SKILL.md) | Package repeatable steps into project skills and reusable templates. Ask necessary questions without copying a fixed interview ritual. |
| Agent replaceability and wrap-up | [Lesson 13 prompts](https://github.com/https-deeplearning-ai/sc-spec-driven-development-files/blob/main/prompts/Lesson_13_prompts.md), repository's final snapshot overview | Keep authoritative Markdown independent of provider-specific wrappers; retain tests as evidence when switching agents. Conclusion transcript unavailable. |

Prompt numbering in the repository differs from the video-folder numbering; links above use the actual published filenames.

## The document structure

```text
openspec/
  project/
    mission.md                  users, outcomes, scope and non-goals
    tech-stack.md               architecture constraints and check commands
    roadmap.md                  small phases, dependencies and completion links
    workflow.md                 the project's SDD document and review contract
  schemas/clinic-sdd/
    schema.yaml                 native OpenSpec artifact dependencies
    templates/*.md              reusable, project-editable templates
  specs/<capability>/
    spec.md                     accepted behavior and scenarios
    design.md                   maintained design reference, where available
    validation.md               maintained coverage reference, where available
  changes/<feature>/
    .openspec.yaml
    research.md                 existing intent, sources, uncertainty, decisions
    proposal.md                 why, scope, capability changes and impact
    specs/<capability>/spec.md   native requirement deltas and scenarios
    design.md                   solution, alternatives, contracts/data applicability
    validation.md               exact scenario → check → expected evidence
    tasks.md                    dependency-ordered slices, each with verification
    contracts.md                optional, when an interface change needs it
    data-model.md               optional, when a data change needs it
  changes/archive/<date-feature>/  immutable feature history
```

The course uses requirements.md and plan.md. Clinic maps those responsibilities onto native spec.md, design.md and tasks.md to avoid two competing requirement sources. Accepted capability notes summarize current design and coverage; dated change artifacts explain how it evolved. Clinic's GUI links both. Setup supplies shared guidance/templates and complete **future change** folders; it does not invent design decisions or passing test evidence for an arbitrary existing application.

## Practices and deliberate adaptations

- **Intent before implementation.** Search existing capabilities and pending changes, then capture the smallest necessary behavioral delta. Context includes the constitution, not just the latest message.
- **Research when it answers a question.** Record repository/source references, date, alternatives, chosen decision and uncertainty. A simple fix can explain why external research is unnecessary. Unavailable transcripts or environments remain explicitly unavailable.
- **Separate what, how and proof.** Requirements state externally observable behavior; design records technical tradeoffs; validation defines the checks; run evidence records what actually happened. Draft scaffolding is never approval or verification.
- **Interfaces deserve explicit contracts when relevant.** Cover inputs, outputs, errors and compatibility. [Spec Kit's contract guidance](https://github.com/github/spec-kit/blob/main/docs/guides/contract-driven-development.md) supports matching contract detail to the boundary; extra documents are conditional rather than mandatory filler.
- **Small verifiable slices.** Each task group includes its own meaningful tests. Include failure, access, recovery and responsive UI cases when they affect the requested behavior.
- **Replan from evidence.** A requirement or shared-context change invalidates approval/QA. Missing dependencies and manual checks remain unverified. Archival and Git integration are separate events.
- **Preserve interoperability.** [OpenSpec workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md) keep deltas and archived history; [native schema customization](https://github.com/Fission-AI/OpenSpec/blob/main/docs-lab/customize/schemas.md) supplies the document sequence. Clinic validates against its pinned OpenSpec version rather than assuming the latest documentation matches the installed CLI.

Clinic's default workflow adds an explicit validation plan and a concise research record. Those are product choices informed by the sources, not a claim that every SDD framework requires the same file list. Existing external schemas remain supported and customized files are preserved during setup.
