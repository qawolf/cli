---
"@qawolf/cli": patch
---

Upgrades `@qawolf/api-contracts` to `0.39.0`.

That release adds the `authConfigResponse` schema, which gives the WorkOS client id that a client must send to start a device authorization grant. No command changes: the CLI does not read the schema yet, and the release adds no endpoint contracts for the generated public-API commands.
