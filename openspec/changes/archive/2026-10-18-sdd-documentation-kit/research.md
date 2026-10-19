# Research

See [the source-by-source review](../../../../docs/sdd-practices.md). The lesson endpoint returned 403 and the complete video transcripts could not be accessed. All ten official prompt files and both course skills were read; the constitution examples were inspected for structure and selected content; no third-party transcript was treated as primary evidence.

## Findings and decisions
- Course artifacts separate project constitution from feature requirements, plan and validation. Preserve this separation, using native OpenSpec requirement/delta names instead of duplicating them.
- The current GUI excludes archives from capability groups. Historical proposal/design/tasks already exist but were hard to discover. Link them to their capability and show lifecycle labels.
- New manual changes currently create only proposal and metadata. Scaffold the entire feature bundle as a reviewed draft; reject unresolved draft markers and uncovered validation scenarios at approval.
- OpenSpec 1.14.2 ships schema definitions and templates. Use its native schema validation/status/instructions, with a project-local `clinic-sdd` schema rather than a second proprietary workflow format.
- Existing default skills are preserved forever, including obsolete stock versions. Upgrade exact old defaults in reviewed setup proposals, preserve all customized content.
- New setup cannot know arbitrary business intent. Proposed mission/roadmap documents mark unresolved intent; actual Clinic documents are written from its user's requirements and repository evidence.

## Alternatives and boundaries
Rejected copying requirements.md/plan.md alongside OpenSpec's equivalents because it creates competing sources. Rejected filling every existing project's capability folder with inferred design claims; setup installs templates and future feature bundles, while Clinic's own current capability notes are authored with repository references. Optional contract/data-model documents are proportional to the feature. A schema status of done means files exist, not that scenarios passed; Clinic's approval and runtime QA remain separate checks.
