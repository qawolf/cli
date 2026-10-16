---
"@qawolf/cli": minor
---

`qawolf runner run` can add variables on top of a QA Wolf environment for one run. `--var NAME=VALUE` (repeatable) adds one variable, and `--env-id` with `--env-file` puts the file's variables on top of the environment's. The QA Wolf environment itself is not changed. Needs the QA Wolf platform release that lets `runner.runFlow` take both an environment and variables; until then QA Wolf refuses a run that sends both.
