# Keep newly archived capabilities valid

## Why
OpenSpec can validate a new capability delta without a Purpose section, then generate an incomplete placeholder when archiving it. Clinic's first archive exposed this mismatch between change validation and accepted-spec validation.

## What Changes
- Require an explicit purpose for newly introduced capabilities before approval.
- Include the requirement in prompted editing guidance.
- Verify accepted specs after archive in the delivery fixtures.

## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `spec-workspace`: readiness checks for new capability purpose text.

## Impact
Specification approval and provider prompts. Existing capabilities keep their existing purpose. No implementation code is automatically rewritten.
