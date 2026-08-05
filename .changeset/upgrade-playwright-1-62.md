---
"@qawolf/cli": minor
---

Upgrade Playwright from 1.58.2 to 1.62.0. On 1.58.2, downloading a browser could hang forever, so `qawolf install browsers` never finished. `@playwright/test` moves to 1.62.0 as well, so only one copy of Playwright resolves.

The first command after upgrading re-downloads the browsers.
