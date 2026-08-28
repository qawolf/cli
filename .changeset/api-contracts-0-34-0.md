---
"@qawolf/cli": minor
---

An environment variable a run sends with `--env-file` may now be up to 16 KiB, up from 8 KiB. The CLI checks the cap locally before any round trip, so it refused at 8 KiB whatever the platform accepted.

Upgrades `@qawolf/api-contracts` to `0.34.0`, which carries the raised cap and the `environmentId` field `--env-id` sends.
