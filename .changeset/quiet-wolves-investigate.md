---
"@qawolf/cli": minor
---

`qawolf attempt investigate --attempt-id <id>` summarizes a finished run attempt's trace and execution log, and `qawolf attempt inspect --attempt-id <id>` reads one action, request, snapshot, screenshot, console window or log record from them.

Pins `@qawolf/api-contracts` 0.83.0. That removes `qawolf run getAttemptArtifacts`; use `qawolf attempt get --attempt-id <id>` for an attempt's signed artifact links. It also adds `qawolf environment discard`, `qawolf environment promote`, `qawolf promotion find` and `qawolf promotion get`.
