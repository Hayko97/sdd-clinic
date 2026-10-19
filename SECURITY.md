# Security

Do not include tokens, credentials or private project content in public issues. For security-sensitive reports, use the repository's private vulnerability reporting feature when available. Otherwise contact the maintainer through their GitHub profile to arrange a private channel before sharing sensitive details.

SDD Clinic is a local single-user application. Keep the service bound to loopback. Provider authentication and repository access are powerful; only connect projects and services you intend Clinic to access. See the source and package lockfiles for dependencies.
