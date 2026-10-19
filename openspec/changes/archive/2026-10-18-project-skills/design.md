## Context
Native OpenSpec artifacts remain authoritative. Existing implementation/QA records already bind evidence to revisions.
## Decisions
Store portable SKILL.md files under .clinic/skills; add project provider discovery entrypoints under .agents/skills and .claude/skills. Missing-only setup preserves customization. Explicitly inject canonical skill content into Clinic runs, independent of provider discovery. Display evidence-derived change implementation status, never infer completion from archival or tasks alone. Spec creation compares accepted and pending requirements and records overlap decisions in design.
Use Docker Compose with host loopback port publication, internal all-interface binding, persistent state/provider homes and an explicit project-root mount. Container CLIs authenticate independently; host executables and credentials are not copied.
## Research
- https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md : propose/apply/verify/archive workflow.
- https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md : accepted specs and delta changes.
- https://agentskills.io/specification : SKILL.md frontmatter and portable skill directories.
## Risks
Semantic duplication needs model review; do not claim deterministic equivalence detection. External baseline specs have unknown implementation until evidence exists. Docker cannot execute macOS CLI binaries; install Linux providers in the image and authenticate there.
