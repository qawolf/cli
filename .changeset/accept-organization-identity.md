---
"@qawolf/cli": minor
---

`qawolf auth whoami` now reports organization and user identities, not just teams. It consumes the shared `identityResponse` from `@qawolf/api-contracts` (bumped to 0.17.0) instead of a hand-rolled schema, so it can't drift from the platform: a team API key reports its team, an organization API key its organization, and a user API key the user (email) plus their organization.
