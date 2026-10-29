---
"@qawolf/cli": patch
---

`agent get --follow` and `agent send --follow` now wait on the QA Wolf API for news instead of asking again every few seconds: one session waits with a held `agent.get` from where the last read ended, and `--sessions` waits on every session in one held `activity.wait`. `runner events --follow` and `runner run --follow` read every second while entries arrive and slow down to every five seconds while nothing does. `--sessions` now takes at most 50 session ids.
