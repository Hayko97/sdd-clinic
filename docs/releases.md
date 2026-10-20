# Public releases

Source: https://github.com/Hayko97/sdd-clinic
License: MIT
npm package: sdd-clinic
Docker image: sintyoa/sdd-clinic

## Install a published version

```sh
npm install --global sdd-clinic
sddclinic start
# In an existing project:
sddclinic setup --rebuild --model gpt-6.1-sol --reasoning medium
```

Node.js 24+ and Docker with Compose are required. The npm package includes the GUI assets and launcher. Runtime dependencies and provider CLIs run inside the matching Docker image; provider sign-in happens when required. `sddclinic start` opens the global GUI. The published launcher pulls the exact package version; it does not silently substitute latest. Use `SDDCLINIC_BUILD=1 sddclinic start` to explicitly build from the bundled runtime assets. Release0.1.0 publishes verified Linux amd64 and arm64 image manifests.

## Prepare a release

Run `pnpm check` then `pnpm test:e2e`, inspect public source for private data, and run `pnpm pack:release`. The artifact is `releases/sdd-clinic-<version>.tgz`. Install that exact archive into an isolated npm prefix and verify both CLI and GUI. The host manifest deliberately has no application dependencies; `runtime/package.json` and the pinned runtime lockfile are used by Docker.

Publish source, tag the exact tested revision, publish the matching Docker image and then publish the tarball. Verify anonymous Docker image access and the npm registry version before describing publication as complete. Docker Hub creates the repository on first push when allowed; verify its public visibility.

## Future automated releases

`.github/workflows/ci.yml` runs source, browser and package checks. `.github/workflows/publish.yml` is explicitly dispatched from main for a matching existing version tag. Configure repository secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` with a suitable publishing token. Configure npm trusted publishing for owner Hayko97, repository sdd-clinic, workflow publish.yml, environment npm. Protect that environment as appropriate. Initial npm publication may require interactive login and account verification. Workflow presence alone does not mean registry credentials are configured.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [Docker Hub publishing](https://docs.docker.com/docker-hub/repos/create/).

The public image contains Codex with its package license notices. Claude Code is fetched directly from its vendor distribution on first invocation and cached in the private runtime volume; this requires network access on first use. Its separate vendor terms apply.


## Update and repair missing SDD documents (0.1.1)

```sh
npm install --global sdd-clinic@0.1.1
# Run from the existing project; this explicit package bypasses older local launchers:
npx --yes --package=sdd-clinic@0.1.1 sddclinic setup --repair
```

Review and accept the displayed diff. Repair creates missing per-capability validation plans, shared workflow documents, agent skills/instructions and a missing CHANGELOG.md. Existing custom specs, validation and changelog files are preserved. It does not call a model, audit application source or run application tests. Every generated validation check starts UNVERIFIED. An existing root changelog with different capitalization is respected.

For an existing application without specifications:

```sh
npx --yes --package=sdd-clinic@0.1.1 sddclinic setup --model gpt-6.1-sol --reasoning medium
```

Add `--rebuild` only when you want comprehensive source analysis and a reconstruction blueprint. For a new application with no source, run `npx --yes --package=sdd-clinic@0.1.1 sddclinic start` and use the new-project prompt/document flow; it creates specifications plus validation from your product requirements. Empty-code repair cannot invent product intent. Native proposal, research, design and tasks templates are installed for future actual changes, rather than fabricated implementation records.

If `sddclinic` still behaves like an older version, inspect `type -a sddclinic`; an earlier local wrapper can precede the npm executable on PATH. The versioned npx commands above select the published version explicitly. Node.js24+ and Docker Compose are required.

## Setup quality and large-project analysis (0.1.2)

```sh
npm install --global sdd-clinic@0.1.2
# Use an explicit package to bypass any earlier local launcher:
npx --yes --package=sdd-clinic@0.1.2 sddclinic setup /absolute/path/to/project --deep --engine codex --model gpt-6.1-sol --reasoning medium
```

Setup preserves accepted specifications and presents missing source-backed specifications and companion guidance for review. It reports defects and unmet requirements; it does not silently rewrite custom specifications or fix application code. Use the installed `analyze-request` → `refine-spec` → `implement-spec` skills for changes to existing intent and implementation. For missing SDD documents alone, use `setup /absolute/path/to/project --repair`.

Deep analysis reviews all eligible source and can require many provider calls. Large finding sets now use a single consolidation pass with explicit output budgets and immutable source references; detailed original-evidence review is batched. Unsupported individual context sizes and generation defects stop the proposal without project writes. Semantic completeness and application test results remain unverified until separately reviewed and tested.
