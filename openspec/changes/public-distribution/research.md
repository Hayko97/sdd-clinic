# Research

2026-10-19: current project package is UNLICENSED and has no initial commit or remote. Existing package includes GUI assets but always builds Docker locally and would install runtime dependencies on the host. Git credential helper authenticates Hayko97; the connected GitHub app requires reauthentication but is unnecessary for API work. npm package/repository names are available; npm is unauthenticated.

Primary references: https://docs.npmjs.com/trusted-publishers/ (OIDC setup and Node/npm requirements); https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images (Docker Hub workflow); https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry (visibility and image access). License pending owner choice.

Provider package metadata: Codex Apache-2.0; Claude Code SEE LICENSE IN README.md, official https://github.com/anthropics/claude-code/blob/main/LICENSE.md refers to separate Anthropic terms. Public image obtains Claude at runtime rather than redistributing proprietary binaries.
