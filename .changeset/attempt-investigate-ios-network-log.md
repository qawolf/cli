---
"@qawolf/cli": minor
---

`qawolf attempt investigate` lists the failed requests of an iOS attempt. An iOS attempt has no trace, so `networkErrors` now comes from the device network log (`networkLogsUrl`). Each request has a `failureReason`: `http-error`, `connection-failed`, `canceled` or `interrupted`. A normal close of a tunnel QA Wolf did not read is not a failure. App cancels fill only the places other failures leave. For 2 minutes after the attempt ends, a missing log shows as `pending`, and a log that was not read sets `coverage.incomplete`.
