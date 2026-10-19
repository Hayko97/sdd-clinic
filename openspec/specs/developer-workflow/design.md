# developer-workflow: current design reference

## Scope
[Accepted behavior](spec.md) is authoritative. This document summarizes the present architecture; dated proposals and decisions remain in related change folders exposed by the GUI.

## Approach and tradeoffs
Workflows persists analysis, authoring, review, implementation and QA state. It uses the selected project or agent engine and binds proposal context to repository revisions. Continuing a reviewed workflow applies its pending proposal and approves current artifacts before isolated development. Concurrency guards reject overlapping continuation. Prior conversation context is bounded and scoped to the same project and agent.

## Implementation references
- [src/server/workflows.ts](../../../src/server/workflows.ts)
- [src/server/runs.ts](../../../src/server/runs.ts)
- [src/server/store.ts](../../../src/server/store.ts)

## Verification boundary
Live model analysis remains distinct from recorded protocol fixture behavior; incomplete proposals must be refined before continuation.

Changes to this design reference invalidate approvals that included its revision. Do not rewrite historical artifacts to imply new verification.

## Durable stage clarification
Clarification records retain stage, question/answer history, change and applicable spec/code revisions independently of a provider process. Pending intent blocks approval and delivery. Continuation preserves workflow identity and isolated partial work, reanalyzes answers and routes changed behavior through reviewed spec refinement. Native provider questions and structured author/implementation/QA questions use the same durable checkpoint. Ordinary verification failures remain failures, not automatic product questions.
