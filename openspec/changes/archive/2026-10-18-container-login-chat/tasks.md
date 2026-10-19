## Implementation and scenario verification
- [x] Add Codex adapter device login and ephemeral API lifecycle; test completion, rejection, cancel, timeout, duplicate starts and stale path protection.
- [x] Correct runtime guidance and connection status; test unknown authentication and missing executables.
- [x] Build Developer transcript/composer with inline run activity, reviews, approvals, keyboard input and project-scoped drafts; verify browser workflows including reconnect and mobile overflow.
- [x] Add scoped follow-up context and fixture tests for matching and foreign project/agent IDs.
- [x] Run pnpm check and pnpm test:e2e, rebuild Docker, visually inspect served UI, and record live authentication separately from fixture/inference tests.

## Scenario evidence map
| Scenarios | Verification |
| --- | --- |
| Installed but unsigned; sign-in failure/cancel/expiry; duplicate/path conflicts; restart | `tests/auth.test.ts` with the adapter protocol fixture; browser device challenge/cancel/completion in `tests/e2e/workspace.spec.ts` |
| Missing executable and runtime guidance | `tests/engines.test.ts` unavailable binary and `tests/auth.test.ts` Docker command/unknown authentication |
| Prompt, readable progress and reviewed implementation | Browser Developer flow reaches the approved spec, isolated implementation and passing QA; planning JSON is hidden |
| Keyboard, drafts/navigation/reload/project isolation, disconnected provider, narrow layout | Browser workflows exercise Enter, Shift+Enter, IME composition, Up/Down, Escape, draft recovery, a second project, connection navigation and 375px long drafts/inline questions |
| Scoped previous workflow | `tests/workflows.test.ts` supplies bounded previous context and rejects foreign project/agent ownership |
| Read status during implementation | `tests/delivery.test.ts` touches tracked file timestamps and verifies review leaves Git's index unchanged for TypeScript and Python fixtures; browser test watches implementation |
| Real Docker rendering and provider handshake | Playwright inspection of served desktop/mobile chat and project counts; real Codex 0.163.0 device challenge/cancel only. Account authorization and live inference remain unverified. |

An archived checklist records these checks, not integration into a committed baseline. See `docs/verification.md` for source/spec digests and runtime limitations.
