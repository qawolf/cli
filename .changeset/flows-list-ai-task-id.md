---
"@qawolf/cli": minor
---

`qawolf flows list --remote` accepts `--ai-task-id`, listing the flows on that AI task's branch — drafts included — instead of the ones the environment holds at its latest reconciled commit. It defaults to `QAWOLF_AI_TASK_ID`, which an AI task runner already sets, so the flag is only needed to point at another task.
