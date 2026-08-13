---
"@qawolf/cli": patch
---

`qawolf runner` commands now wait up to 60 seconds for the platform to answer, up from 15. Runner calls are answered by a live runner doing the work — starting a browser, evaluating a snippet, capturing a screen — and the first action on a fresh runner regularly needs longer than 15 seconds, which made the CLI report a timeout for work that was still finishing.
