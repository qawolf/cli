---
"@qawolf/cli": minor
---

Add `@qawolf/cli/runner-sdk`, a typed library for driving interactive runners in process rather than by spawning `qawolf runner`. Every verb names the runner it addresses, so nothing is launched or billed implicitly, and answers come back as the `@qawolf/api-contracts` output types rather than parsed stdout.
