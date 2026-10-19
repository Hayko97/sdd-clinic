# SDD Clinic mission

## Users and problem
Serve a single developer managing several local repositories with Codex or Claude. Preserve product intent across agent sessions, make changes reviewable before implementation, and distinguish code that exists from code verified against current requirements.

## Desired outcomes
- Open a project-card home, then one workspace containing the project's Developer chat, agents, schedules, skills and specifications.
- Turn a prompt into intent analysis, duplicate-aware specification creation/refinement, reviewed implementation and independent QA.
- Expose complete project and feature documentation, including archived decisions and validation evidence.
- Use assigned data/server connections for bounded evidence and internal backlog findings without exposing credentials to model prompts.

## Scope and non-goals
Local single-user operation; multiple project registrations; Docker runtime; native OpenSpec artifacts. Hosted accounts, collaborative editing, automatic deployment, automatic merging and native external issue trackers are outside the current release.

## Product constraints
Repository documents are authoritative for intent and portable configuration. Existing project instructions and unrelated work must survive setup and execution. Inferred behavior needs review. Missing environments remain unverified. A spec or checked task alone cannot prove implementation or integration.

## Basis
The owner's project requirements and accepted capability specs in ../specs/. Implementation evidence is indexed in ../../docs/verification.md; source-derived observations do not override approved behavior.
