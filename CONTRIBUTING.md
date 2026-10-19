# Contributing to SDD Clinic

Use Node.js 24+, pnpm 11.25.0 and Docker Compose. Install dependencies with `pnpm install --frozen-lockfile`. Read AGENTS.md, openspec/config.yaml and openspec/project/ before changing behavior. Propose observable scenarios in a named OpenSpec change, implement the reviewed change and record actual validation.

Run `pnpm check` followed by `pnpm test:e2e`. Use `pnpm exec playwright install chromium` when needed. Live-provider tests are opt-in. Run the application with Docker Compose; do not commit credentials, runtime state or private project data. Submit a pull request with the problem, behavior change and validation evidence.

## Releases

See [release instructions](docs/releases.md). Only maintainers publish registry artifacts. Contributions are licensed under the project's MIT license.
