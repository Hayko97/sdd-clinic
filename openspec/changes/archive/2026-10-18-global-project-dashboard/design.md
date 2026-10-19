## Decisions
Extend existing management views rather than duplicate project-skills setup requirements. Registration and deterministic setup do not invoke a model. The home page lists registered repositories, not arbitrary host folders. Counts are read from repository artifacts; unreadable repositories show unavailable status without hiding other projects. Docker paths refer to the configured /projects mount; mounting additional host folders remains Docker configuration.
## Verification
API test: unauthenticated provider registration, reviewed setup, counts after apply, repeat registration. Browser: global landing, project navigation, existing setup workflow. Run required checks and Docker smoke test.
