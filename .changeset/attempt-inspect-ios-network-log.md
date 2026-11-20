---
"@qawolf/cli": minor
---

`qawolf attempt inspect --network` and `--request <id>` read the device network log of an iOS attempt: request IDs are the log's cursors and times are epoch milliseconds. `--network --failed` returns only failed requests, for a trace too. When the log cannot be read, the `unavailable` answer has its `networkLogStatus`, such as `pending` for 2 minutes after the attempt ends.
