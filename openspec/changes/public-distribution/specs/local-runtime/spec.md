## ADDED Requirements

### Requirement: Public package installation
Clinic SHALL provide a public package-manager distribution that installs the global CLI and can start the local GUI without cloning its source repository. The release SHALL identify its source repository, license and matching container version.

#### Scenario: Install CLI and GUI from a release
- **WHEN** a user installs a published release with supported Node and Docker Compose
- **THEN** sddclinic setup and sddclinic start are available, and start launches the bundled GUI using the matching runtime image.

#### Scenario: Runtime image is unavailable
- **WHEN** the published image cannot be pulled
- **THEN** the launcher explains the failure and explicit source-build option without silently substituting another release.

#### Scenario: Build from source
- **WHEN** a developer uses a source installation or explicitly chooses the build option
- **THEN** the runtime can be built from included manifests/assets without requiring a public registry pull.

### Requirement: Reviewed public release artifacts
Clinic SHALL publish source and distribution artifacts only from a checked revision with an explicit open-source license and without credentials or private runtime data.

#### Scenario: Verify distribution before publication
- **WHEN** a release is prepared
- **THEN** type checks, tests, native specification validation, package contents and CLI/GUI smoke checks are recorded before publication.

#### Scenario: Publication requires account access
- **WHEN** a registry rejects authentication or owner interaction is required
- **THEN** completed artifacts are retained, the missing action is reported precisely and unpublished artifacts are not described as published.

#### Scenario: Obtain separately licensed provider tooling
- **WHEN** a public-image user first invokes a provider tool whose binaries are not redistributed
- **THEN** Clinic obtains the pinned tool from its vendor distribution into private runtime storage, preserves the provider's license and propagates installation errors without claiming readiness.
