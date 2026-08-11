---
"@qawolf/cli": patch
---

Show the server's reason when a public API call fails, instead of only an HTTP
status. A rejected request now prints why it was rejected without needing
`--verbose`.
