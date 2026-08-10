---
"@qawolf/cli": patch
---

Show flow failure detail in json output. Before this change, a failed `flows run` printed only `{"type":"error","title":"N flow(s) failed"}` in json mode. The CLI also selects json mode in CI and when stdout is piped. The failure message and stack only reached disk through the `--junit` report. The final error event now includes a `body` field. The `body` field contains the message and the cause stack for each failed flow. Human and agent modes do not change. They already show the failure detail inline.
