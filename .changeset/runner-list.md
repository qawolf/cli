---
"@qawolf/cli": minor
---

`qawolf runner list` names the runners a directory holds that are still running, and marks the one a command with no `--runner` would reach. Every runner is looked up before it is listed, so one that idled out is absent rather than reported, and the lookup neither starts a runner nor resets an inactivity clock.
