---
"@qawolf/cli": minor
---

`qawolf run create` forwards `QAWOLF_CHAT_SESSION_ID` as `chatSessionId`, so a run started from a chat session reports its result back into that chat. Pins `@qawolf/api-contracts` 0.38.0.

The contract rejects `aiTaskId` and `chatSessionId` together, and an AI task pod that holds a conversation exports both variables, so the CLI sends one: an explicit flag beats an ambient variable, and when both are ambient the task id wins, which is the id such a pod sends today.
