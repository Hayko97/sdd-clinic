# Research

Reviewed 2026-10-18. Repository evidence is sufficient; no external protocol changes or new dependencies are proposed.

- Projects.inspect samples at depth four and 1,500 entries, with bounded schema/test references. This is appropriate for quick scaffold inspection but does not establish project-wide analysis.
- Runs already supports durable asynchronous read-only provider operations, events, cancellation, restart interruption and model adapters. Reuse it for setup rather than invent a second provider runner.
- SpecRepository proposes diffs, checks original hashes, validates exact paths and stages writes. Extend its proposal boundary for newly inferred baseline specs and repository fingerprints.
- Reviewed project setup, portable instructions and conflict-safe editing in spec-workspace already own installation and preservation. Add baseline analysis there; keep the existing developer-workflow and project-skills authoring/implementation contracts.
- Complete management views in clinic-interface allows provider-free setup. Preserve that mode with an explicit statement that model analysis has not run.
- Existing source/spec observations are evidence, not automatically intended behavior. Require source references, uncertainties and owner review; avoid representing discovered bugs as approved requirements or test results.
- No active change overlapped this request when work began. Prior portable-agent-instructions and sdd-documentation-kit changes remain the basis for agent files and project documentation.

## Limits
All eligible files are inventoried, read and supplied to analysis in bounded batches. Dependencies, generated output, Git internals, ignored content, credentials, symlinks and binary files are excluded with reasons. Unexpected read errors or resource limits prevent a completed baseline instead of silently truncating. Model reasoning quality and exhaustive semantic inference require live-provider evaluation; fixtures establish delivery, coverage accounting and review boundaries only.
