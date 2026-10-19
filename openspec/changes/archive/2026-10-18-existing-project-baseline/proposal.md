# Derive existing project specifications during setup

## Why
Existing-project setup currently samples manifests, schemas and tests and installs guidance. It does not read the complete eligible project or produce capability specifications from its implementation and documentation.

## What Changes
- Recursively inventory and read eligible project files, including deeply nested source, tests, configuration and documentation; disclose excluded files and limits.
- Analyze every eligible text chunk with the configured provider, reconcile documentation and implementation, and generate evidence-linked capability specs plus a coverage report.
- Review the inferred baseline and existing portable agent files in one setup proposal before writing anything. Preserve existing specifications and custom instructions.
- Expose progress, cancellation, durable review and clear no-provider/failure states. Keep local setup available without model execution.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `spec-workspace`: comprehensive source-derived baseline setup and stale-source rejection.
- `clinic-interface`: setup analysis progress, coverage and review.

## Impact
Repository inventory, provider-backed setup orchestration, bounded output validation, setup proposal application, API, browser UI, fixture tests and documentation. Provider protocols and credentials remain behind existing adapters/broker. No implementation, merge or deployment is authorized by baseline creation.
