---
"@qawolf/cli": minor
---

`qawolf runner run` takes `--flow-id`, the QA Wolf flow the run is for, and falls back to `QAWOLF_WORKFLOW_ID` when the flag is absent. The run then sees that id as `QAWOLF_WORKFLOW_ID`, the same value a platform run of the flow sees, so fixtures a flow names and cleans up by its workflow id match across both. A run that names no flow is unchanged. The `@qawolf/cli/runner-sdk` `run` verb takes the same `flowId`.
