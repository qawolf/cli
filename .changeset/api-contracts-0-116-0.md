---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.116.0`.

`qawolf runner run` and `qawolf agent send` take `--builds <ids...>`, the builds from `qawolf build create` that the run or the session installs over the environment's builds of the same app and platform. Put the flow file or the message before `--builds`, which takes every word after it.
