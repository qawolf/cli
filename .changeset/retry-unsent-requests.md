---
"@qawolf/cli": patch
---

When nothing was sent because the connection to the QA Wolf API never opened, the CLI now retries the request, including actions like `runner act`.
