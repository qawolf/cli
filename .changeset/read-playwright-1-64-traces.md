---
"@qawolf/cli": patch
---

`qawolf attempt investigate` and `qawolf attempt inspect` read screenshots, snapshots, and response bodies from traces recorded by Playwright 1.64 and later again. Before, they found none of them in those traces, so `--screenshot` and `--snapshot` answered not found and `--request` reported no body.
