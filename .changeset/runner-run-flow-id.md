---
"@qawolf/cli": minor
---

`qawolf runner run --flow-id` names the flow a run is for when the platform cannot tell from the entry point. The run receives it as `QAWOLF_WORKFLOW_ID`, like a platform run of that flow does, so fixtures keyed by that id match across both. The runner SDK's `run` verb takes the same `flowId`.
