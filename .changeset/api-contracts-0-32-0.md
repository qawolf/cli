---
"@qawolf/cli": minor
---

A run may now carry up to 200 environment variables, up from 100. The CLI checks the cap locally before any round trip, so it refused at 100 whatever the platform accepted.

Upgrades `@qawolf/api-contracts` to `0.32.0`, which also adds two runner failure reasons. `qawolf runner inspect` against a mobile runner now says so instead of reporting an unknown answer, and `qawolf runner act` says what a touchscreen does instead when it cannot perform the action as asked.
