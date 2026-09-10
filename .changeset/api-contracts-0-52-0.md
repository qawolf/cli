---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.52.0`.

That release adds two endpoint contracts, and the generator adds one public-API command for each. `qawolf email registerAddress` registers an inbox address for the workspace. `qawolf run stop` stops a run, including its queued flows and automatic retries.

The release also rewrites the descriptions of `qawolf agent send` and `qawolf agent get`. Both now say to share the session URL the send returns, and how often to poll while work is running.

It adds a `withScreenshot` option to `runner.performAction` as well, which no command uses yet.
