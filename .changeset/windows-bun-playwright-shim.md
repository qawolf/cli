---
"@qawolf/cli": patch
---

Find Playwright and Appium on Windows in projects installed with bun. The CLI looked for `node_modules/.bin/playwright.cmd` and the extension-less POSIX shim, which are the shims npm writes. `bun install` writes `playwright.exe` instead, so `qawolf doctor` reported Playwright as missing, and `qawolf flows run` and `qawolf install browsers` failed on such a project. The same wrong name list gated the pinned-dependency check, which made the CLI reinstall the runtime on every run. `appium` had the same bug, which broke Android flows and `qawolf install android`. The CLI now accepts the `.exe` shim for both.
