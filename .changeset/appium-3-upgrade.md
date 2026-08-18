---
"@qawolf/cli": minor
---

The managed runtime uses Appium 3.6.0 and the UiAutomator2 driver 8.4.0.

Appium 2.11.3 installed five copies of `axios` before version 1.15.1. These versions have a header injection defect (CVE-2026-42035). Appium 3.6.0 installs one copy of `axios` 1.18.1.

`appium` becomes a development dependency. The CLI does not import it. It starts Appium from the managed runtime directory. An install of `@qawolf/cli` is thus smaller: 413 packages in place of 797.

The managed runtime directory has a new name, so the CLI installs the runtime again when you first run a flow.
