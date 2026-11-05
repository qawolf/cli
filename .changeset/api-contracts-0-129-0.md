---
"@qawolf/cli": minor
---

`qawolf run diagnose` takes `--failures`, which diagnoses an attempt's failures one by one. When one attempt failed on several checks, such as `expect.soft()` checks, each failure can go to its own bug report or blocker: pass it as `<attemptId>:<position>`. `qawolf attempt get` now lists an attempt's failures in `failures`, each with its `position`, soft failures first and the failure that stopped the flow last. `--flow-ids` is now optional, and the command needs `--failures` or `--flow-ids`. With `--flow-ids`, a flow whose attempt failed on several checks is refused with `several-failures`.

Upgrades `@qawolf/api-contracts` to `0.129.0`, which also changes these commands. `qawolf deployment reportStatus` takes `--changes <json>`, the pull requests, commits and release notes that the deployment ships, so a trigger where QA Wolf chooses the flows works without a pull request. `qawolf issue create --type coverageRequest` takes `--file-paths`, and `qawolf issue attachFiles` also adds files to a coverage request. `qawolf issue get` lists the newest failures diagnosed to the issue in `recentFailures`. `qawolf investigation get` reports the flows the investigation must still finish in `completion`, and whether a person stopped it in `isStopped`. `qawolf activity wait` marks a run whose failed flow has no diagnosis with `needsReview`. `qawolf promotion get` gives the session of the AI that resolves the promotion in `aiTaskSessionId`. `qawolf build requestUpload` and `qawolf build upload` take files up to the workspace's limit, 1 GB by default.

`qawolf run create` lists `--investigate-failures`. The flag can only send true, which keeps the workspace's investigation policy, so the CLI cannot turn off investigation for one run yet.
