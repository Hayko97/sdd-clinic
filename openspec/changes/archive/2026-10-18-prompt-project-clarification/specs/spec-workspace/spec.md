## ADDED Requirements

### Requirement: Product source project setup
Clinic SHALL generate reviewable new-project SDD packages from prompts and supported product documents or images, preserving source evidence and existing intent.

#### Scenario: Prompt and attachment setup
- **WHEN** a user supplies a prompt, supported documents or images for a new or existing destination
- **THEN** Clinic analyzes all accepted inputs and proposes native capability specs, project and UI/UX guidance, original sources and portable agent instructions without writing the destination.

#### Scenario: Clarify conflicting product sources
- **WHEN** important intent is missing or contradictory
- **THEN** setup asks focused questions, retains answers and does not produce an applicable final proposal until blocking decisions are resolved.

#### Scenario: Review and apply new project package
- **WHEN** the owner applies the reviewed setup
- **THEN** Clinic creates the destination if needed and saves the reviewed package, preserves existing custom files and specs, and does not initialize Git or implement the product.

#### Scenario: Recover setup and reject incomplete sources
- **WHEN** uploads are unreadable or unsupported, the provider is disconnected, or a run stops
- **THEN** Clinic retains the draft, explains the problem and requires explicit correction or retry without silently omitting content.

#### Scenario: Protect changed setup destinations
- **WHEN** a source or destination changes after generation
- **THEN** application rejects stale proposals before writing and requires regeneration.
