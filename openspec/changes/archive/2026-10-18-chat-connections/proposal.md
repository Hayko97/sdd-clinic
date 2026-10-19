## Why
Connection forms interrupt the project conversation. Users want to paste credentials once and let a selected agent use the saved connection. Docker currently loses broker credentials after restart when no OS keyring exists.
## What Changes
- Save supported database URLs, SSH commands and credential blocks from the project composer without a dedicated data-connection setup page.
- Keep credential input transient, return only non-secret confirmation, and show saved sources inline with test/update/remove actions.
- Persist credentials in the OS keyring or an encrypted local vault in the application volume, with explicit agent grants.
- Expose assigned sources to the selected agent through existing bounded broker tools, including Developer planning/implementation when explicitly assigned.
## Capabilities
### New Capabilities
None.
### Modified Capabilities
- `product-analysis`: prompt import, persistence and per-agent connection access.
- `clinic-interface`: inline connection setup and management in the project chat.
## Impact
Chat composer, connection parser/API, credential vault, MCP access enforcement and scoped agent context. Existing database/SSH adapters and read-only limits remain authoritative. No arbitrary remote shell or universal protocol support is implied.
