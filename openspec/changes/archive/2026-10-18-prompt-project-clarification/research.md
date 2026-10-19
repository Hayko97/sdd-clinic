# Research

Existing setup-analysis, proposal atomic staging, workflows, run events and provider adapters are reusable. Existing clarification restarts workflows; image input and attachment storage are absent. Preserve OpenSpec and local Docker architecture.

Primary references consulted 2026-10-18:
- https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/turn.rs (localImage input)
- https://code.claude.com/docs/en/cli-reference (stream-json input)
- https://platform.claude.com/docs/en/build-with-claude/vision (base64 image content)
- https://github.com/mwilliamson/mammoth.js (raw DOCX extraction)
- https://mozilla.github.io/pdf.js/examples/ (PDF page text extraction)

Live providers are opt-in and unverified. Fixture protocols do not establish semantic quality.
