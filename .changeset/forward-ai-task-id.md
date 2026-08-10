---
"@qawolf/cli": patch
---

Pass `QAWOLF_AI_TASK_ID` to the public `run create` API input when the generated `--ai-task-id` option is available. An explicit `--ai-task-id` value takes precedence over the environment.
