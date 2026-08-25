---
"@qawolf/cli": minor
---

The new command `qawolf run reattempt` requests new attempts for a run's flows, in the same run. A flow is eligible when its result is failed or canceled, and QA Wolf completed its automatic retries. Omit `--flow-ids` to reattempt all of the eligible flows. A run that is fully investigated does not accept reattempts.

The commands `qawolf environment find`, `qawolf tag list`, and `qawolf tag create` accept a new `--workspace-id` flag. Give the workspace when you authenticate with an organization key or a user key.

`qawolf run create` now reports the flows that it left out of the run. Each entry in `excludedFlows` gives the flow and the reason: `deleted` if the flow was deleted, or `not-on-branch` if the flow has no file at the commit that the run was created from. Flows that you select with tags are not reported.
