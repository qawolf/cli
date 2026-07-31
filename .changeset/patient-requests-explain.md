---
"@qawolf/cli": patch
---

A request that runs out of time now says it timed out and how long it waited, instead of reporting an unreachable host and sending you to check your network and `QAWOLF_HOST_URL`.

Behind that, a call can now carry its own deadline rather than sharing one fifteen-second limit with everything else. Nothing changes for calls the platform answers from its database, which is all of them today; the endpoints whose work genuinely takes longer can ask for the time they need.
