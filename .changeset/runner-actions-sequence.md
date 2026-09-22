---
"@qawolf/cli": minor
---

Add `qawolf runner actions`, which performs a sequence of up to ten browser actions on a runner in one request. The answer says what happened to each action, where the sequence stopped and why, and saves a screenshot after the last action or after every action when asked.

The `@qawolf/api-contracts` upgrade this ships with also brings four new command groups generated from the public API — `qawolf codeHostIntegration` (`find`, `listRepositories`), `qawolf deployment` (`find`, `listTriggerEvaluations`, `reportStatus`), `qawolf legacyTrigger` (`find`, `pause`, `resume`) and `qawolf skill` (`get`, `list`) — and a `--workspace-id` flag on `qawolf run create`.
