---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.113.0`.

`qawolf runner run` and `qawolf agent send` take `--builds <ids...>`, the builds from `qawolf build create` that the run or the session installs over the environment's builds of the same app and platform. Put the flow file or the message before `--builds`, which takes every word after it.

This version also adds `qawolf activity wait`, which holds until a Tester session or run changes, `qawolf issue comment` and `qawolf issue listComments`, and `qawolf run get --wait-seconds`, which holds until the run's status changes. `qawolf issue update --priority` now says which bug priorities block a suite.
