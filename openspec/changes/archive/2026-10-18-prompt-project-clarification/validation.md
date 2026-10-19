# Validation

| Exact scenario title | Check | Expected evidence |
| --- | --- | --- |
| Prompt and attachment setup | setup-drafts fixture/API and browser tests | Observable result and preserved files/state asserted |
| Clarify conflicting product sources | setup-drafts fixture/API and browser tests | Observable result and preserved files/state asserted |
| Review and apply new project package | setup-drafts fixture/API and browser tests | Observable result and preserved files/state asserted |
| Recover setup and reject incomplete sources | setup-drafts fixture/API and browser tests | Observable result and preserved files/state asserted |
| Protect changed setup destinations | setup-drafts fixture/API and browser tests | Observable result and preserved files/state asserted |
| Clarify at every development stage | clarification workflow/delivery fixture tests | Observable result and preserved files/state asserted |
| Resume clarification without losing work | clarification workflow/delivery fixture tests | Observable result and preserved files/state asserted |
| Review requirements changed by answers | clarification workflow/delivery fixture tests | Observable result and preserved files/state asserted |
| Recover and protect pending questions | clarification workflow/delivery fixture tests | Observable result and preserved files/state asserted |
| Avoid unnecessary clarification | clarification workflow/delivery fixture tests | Observable result and preserved files/state asserted |

Run pnpm check, pnpm test:e2e and Docker desktop/mobile checks. Live semantic quality remains separately unverified.
