---
"@qawolf/cli": patch
---

`qawolf runner launch` now warns when `QAWOLF_RUNNER_ID` is set to a different runner than the one just launched, since that variable outranks the directory default and would otherwise send runner-less commands to the stale runner without any indication why.
