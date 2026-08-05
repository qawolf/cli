---
"@qawolf/cli": minor
---

Upgrade the pinned Playwright from 1.58.2 to 1.62.0. Playwright 1.58.2 ships a zip-extraction dependency that can hang forever while unpacking a downloaded browser, so `qawolf install browsers` (and the browser install inside `qawolf flows run`) could never finish and had to be killed. The fix landed in Playwright 1.60.0.

`@playwright/test` moves from 1.60.0 to 1.62.0 in the same step. It had been pinned one minor ahead of `playwright`, which resolved a second, duplicate copy of `playwright` and `playwright-core` in the dependency tree; both now resolve to a single 1.62.0.

Because the pinned version is part of the managed runtime's identity, the first command after upgrading installs a fresh managed runtime and downloads the browsers for 1.62.0. Projects that supply their own dependency directory (`--deps`, or a project `node_modules`) need Playwright 1.62.0 there. `qawolf doctor` reports the version it resolves.
