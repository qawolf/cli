---
"@qawolf/cli": patch
---

`qawolf auth whoami` now works with WorkOS organization API keys. The CLI only accepted a team-shaped `/api/v0/identity` response, so an organization key (which returns `{ organization }`) failed with "Could not verify API key: unexpected response format". The identity response schema now comes from `@qawolf/api-contracts` (bumped to 0.15.0) — shared with the platform, so the two can't drift — and `whoami` reports the organization. The api-contracts bump also brings the CLI's public commands current (`--workspace-id` on org-key-aware commands, plus `environment find`, `environment setVariable`, and `flow addTag`).
