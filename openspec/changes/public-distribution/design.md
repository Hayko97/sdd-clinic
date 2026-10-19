# Design

## Existing intent and overlap
Accepted local-runtime Portable launch and active global-cli-project-setup already cover source installation, terminal setup and global GUI. Reuse them; this change adds public distribution only. Source builds remain available.

## Distribution
Default proposal: Hayko97/sdd-clinic, npm sdd-clinic, Docker Hub sintyoa/sdd-clinic. Confirm license and registry preference before publication. Build and test source, pack it, then produce a public tarball with a minimal dependency-free host manifest and a full runtime manifest inside runtime/. The launcher needs Node built-ins; application dependencies belong in Docker. Public package metadata selects a version-matched registry image; source packages continue building locally. Explicit SDDCLINIC_BUILD=1 allows a source fallback using included runtime assets. Pull failures are actionable and never silently use a different release.

## Release validation
Run pnpm check then browser tests, inspect package contents and scan publishable source for credentials/private environment references. Preserve original private operational notes in a local backup before sanitizing them. Publish GitHub source with a license, push a version tag only for the checked revision, build Linux amd64/arm64 container manifests through GitHub Actions, and verify anonymous image access. npm publication requires owner authentication; prefer future OIDC publishing. No credentials in files, arguments or public logs. Never claim a registry publication succeeded without querying it.

Owner selected MIT and npm + Docker Hub. Existing Docker credential-store account is sintyoa; publish image sintyoa/sdd-clinic. User license choice authorizes the MIT text.

Claude Code has a separate proprietary license. The public Dockerfile.cli includes a lazy launcher that installs pinned Claude Code from the vendor npm distribution into private runtime storage on first invocation, rather than embedding it in the public image. Serialize installation with flock, preserve stderr failures and forward arguments. Codex retains its Apache-2.0 package notices. Source-only Dockerfile remains a local development build.

Public images mark lazy Claude availability explicitly; its first version probe receives a bounded180-second preparation window rather than the normal8seconds. Help/auth remain short. Existing process-group cancellation stops install descendants. Slow cold-probe fixture verifies preparation beyond8seconds.
