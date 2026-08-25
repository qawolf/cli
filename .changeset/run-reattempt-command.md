---
"@qawolf/cli": minor
---

The new command `qawolf run reattempt` requests new attempts for a run's flows, in the same run. A flow is eligible when its result is failed or canceled, and QA Wolf completed its automatic retries. Omit `--flow-ids` to reattempt all of the eligible flows. A run that is fully investigated does not accept reattempts.

The commands `qawolf environment find`, `qawolf tag list`, and `qawolf tag create` accept a new `--workspace-id` flag. Give the workspace when you authenticate with an organization key or a user key.
