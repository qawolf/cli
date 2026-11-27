---
"@qawolf/cli": patch
---

`qawolf attempt investigate` and `qawolf attempt inspect` read a trace over 75 MiB by byte range instead of refusing it, fetching only the parts the command needs.
