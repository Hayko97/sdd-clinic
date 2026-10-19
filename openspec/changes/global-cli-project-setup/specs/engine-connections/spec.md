## ADDED Requirements

### Requirement: Explicit setup model and reasoning
Clinic SHALL configure a setup-specific model and supported reasoning level before terminal project analysis, use a moderate default, expose overrides, and record and enforce the selection through provider adapters without changing unrelated agent settings.

#### Scenario: Choose the setup model before analysis
- **WHEN** full setup starts without explicit model flags
- **THEN** the terminal offers a setup-specific model selection, recommends an available suitable model with medium reasoning, and displays the selected pair before inference.

#### Scenario: Override setup model and reasoning
- **WHEN** the user supplies --model and --reasoning with a supported pair
- **THEN** that pair is shown and used for every analysis, consolidation and synthesis request and recorded in run evidence.

#### Scenario: Do not inherit extra-high setup reasoning
- **WHEN** provider-global configuration or a saved setup profile requests extra-high or higher effort without explicit selection for this run
- **THEN** setup defaults to medium and does not escalate effort without explicit user selection.

#### Scenario: Handle an unsupported setup model pair
- **WHEN** the selected model is unavailable, effort is unsupported or the adapter cannot enforce the selection
- **THEN** setup reports the limitation before analysis when discoverable and otherwise fails visibly on provider rejection without silently changing the pair.

#### Scenario: Save a reviewed setup profile
- **WHEN** the user applies setup after reviewing the selected setup model and effort configuration
- **THEN** the setup-specific profile is saved while existing agent model settings and unrelated configuration are preserved.

#### Scenario: Skip model setup for guidance only
- **WHEN** guidance-only mode is selected
- **THEN** no provider model discovery or inference is required and inference-only flags are rejected as incompatible.
