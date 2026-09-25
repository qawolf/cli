---
"@qawolf/cli": minor
---

`qawolf runner run --flow-id` names the flow a run is for. The run receives it as `QAWOLF_WORKFLOW_ID`, like a platform run of that flow does, so fixtures keyed by that id match across both. Runs that name no flow are unchanged. The runner SDK's `run` verb takes the same `flowId`.
