---
"@qawolf/cli": patch
---

`qawolf runner launch` and `qawolf runner run` now speak the current runner-image vocabulary — `basic`, `playwright`, `android`, `ios`.

Before this change the CLI validated `--name` and the wire response against the published `@qawolf/api-contracts`, which still encodes the pre-rename vocabulary (`node20Basic`, `node20WithPlaywright`, `node20WithAndroid`, `node20WithIos`). `qawolf runner launch --name basic` was refused client-side, and a launch with no `--name` failed on the response parse when the platform answered `basic`. That failure lost the runner's default and every subsequent `runner` command reported the runner as not found. The CLI now restates the runner-image enum in the current vocabulary and wraps `runner.launch` and `runner.runFlow` with schemas that use it, so both verbs work against the renamed platform.
