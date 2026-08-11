---
"@qawolf/cli": patch
---

Use `QAWOLF_ENVIRONMENT` as the default for generated public API `--environment-id` options. Pass `QAWOLF_AI_TASK_ID` to the public `run create` API input when the generated `--ai-task-id` option is available. Explicit flags take precedence over the environment.
