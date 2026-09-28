---
"@qawolf/cli": minor
---

`qawolf investigation get` and `qawolf investigation recordFinding` read and record what the QA Wolf AI concluded about a run's failures, and `recordFinding` fills `--session-id` from `QAWOLF_CHAT_SESSION_ID`, so Tester records a finding on the investigation it runs in. Pins `@qawolf/api-contracts` 0.69.0.
