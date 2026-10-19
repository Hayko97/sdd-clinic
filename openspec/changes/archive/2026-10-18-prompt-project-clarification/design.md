# Design

## Overlap
Extend spec-workspace setup and developer-workflow clarification; reuse existing instruction generation and reviewed changes. No duplicate capability.

## Decisions
Persist setup drafts and uploads in application storage, use temporary staging projects for new destinations, and apply a reviewed text/binary package with stale-source checks. Extract text locally; provider adapters accept image inputs. Use bounded complete-source batches. Preserve originals in openspec/project/sources. New setup never starts implementation.

Persist clarification checkpoints separately with originating stage, question history and revision hashes. Resume workflows with the same identity. Implementation checkpoints retain their worktree; changed intent returns through spec review before resuming. Block approval and delivery while questions are pending.

## Boundaries
Support local MD/TXT/PDF/DOCX/PNG/JPEG. No URL imports or OCR. Failed extraction is visible. No Git initialization, merge or publishing. The current checkout has no initial commit; local self-implementation is not isolated Git integration.

## Supporting artifacts
API contracts are described in docs/api.md; no separate data-model document is required for local typed SQLite records.
