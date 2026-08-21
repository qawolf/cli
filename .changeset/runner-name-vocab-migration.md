---
"@qawolf/cli": patch
---

`qawolf runner launch` and `qawolf runner run` now work against a platform that speaks either the old runner-image vocabulary (`node20Basic`, `node20WithPlaywright`, `node20WithAndroid`, `node20WithIos`) or the new one (`basic`, `playwright`, `android`, `ios`). Both `--name` values are accepted at the CLI boundary, and a response that names a runner in either vocabulary parses.

Before this change, the published schema knew only the old names. `qawolf runner launch --name basic` was refused client-side, and a launch with no `--name` still failed on the response parse when the platform answered `basic`. That failure lost the runner's default and every subsequent `runner` command reported the runner as not found. Production of QA Wolf still speaks the old vocabulary and staging already speaks the new one, so this makes the CLI usable against both while the migration runs.
