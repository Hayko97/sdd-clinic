# Global terminal setup for existing projects

## Why
Users should be able to run `sddclinic setup` inside an existing project to analyze its implementation and SDD assets, review proposed setup and apply it without opening the Clinic browser or changing to the Clinic source checkout.

## What Changes
- Provide a globally installable `sddclinic` entrypoint while retaining `sdd-clinic` compatibility.
- Default setup to the current directory; allow an explicit project path.
- Inventory existing specs, active changes, project guidance, agent definitions, tool instructions and skills alongside eligible source, tests and documentation.
- Reuse reviewed baseline analysis, explain reuse, gaps, conflicts and exclusions, then present the complete diff and require explicit application confirmation.
- Configure and display a setup-specific model and reasoning level before inference; recommend GPT-6.1 Sol with medium reasoning for Codex when available, support explicit overrides, and never inherit extra-high reasoning as the default.
- Provide progress, cancellation, prerequisite diagnostics and explicit guidance-only setup.
- Register successful setup in the global GUI, with an accessible mount and deduplication by canonical host project path. Preserve existing projects and do not interrupt active runs to add mounts.
- Keep Docker as the runtime; the Clinic GUI is not required for setup; provider authentication opens the system browser when needed.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `clinic-interface`: show terminal-configured projects in the global dashboard.
- `local-runtime`: add globally installed terminal entrypoint requirements alongside Portable launch.
- `engine-connections`: add explicit setup model selection and reasoning enforcement.
- `spec-workspace`: add terminal setup and project asset inventory requirements, reusing existing reviewed setup and baseline contracts.

## Impact
CLI packaging/launcher, Docker project mounting, setup orchestration, terminal interaction, fixture tests and documentation. No public publishing, automatic Git operations, implementation, deployment or full terminal Developer/QA workflow is included. Existing browser behavior remains supported.

Owner-requested correction: automatically open normal provider browser sign-in when needed, avoiding forced Codex device-code login.

Correction: full terminal setup must produce an actual reviewed specification baseline, expose generation progress, and repair bounded invalid provider output rather than misrepresent incomplete setup as success.

Owner-requested default correction: generate initial specifications from bounded project context directly; move exhaustive source analysis behind --deep. Destination remains openspec/specs/ as explicitly confirmed.

Owner-requested addition: generate validation.md alongside each new capability spec, with complete scenario mapping and unverified evidence. Preserve source code. Exact reconstruction from an empty codebase remains a clarification; initial sampled analysis cannot establish equivalence.

Clarification: owner means rebuilding from an empty codebase. Add explicit --rebuild for comprehensive eligible-source analysis and a self-contained reconstruction guide, retaining quick initial setup. No claim of exact reproduction without implementation and comparison evidence.

## 2026-10-20: Complete documentation and repair correction
Owner reports capability folders containing only spec.md after setup and requests validation, supporting SDD documents and a changelog, plus update instructions. Extend the existing companion requirement to prompt/document setup; add deterministic missing-document repair and preserve existing project content. Deliver a patch release and verified upgrade/new-project commands after approval and verification.
