---
"@qawolf/cli": patch
---

Local flow runs now use Playwright 1.65.1 with `@qawolf/flows` 0.5.0 and `@qawolf/testkit` 3.0.0. Playwright 1.65.1 ships a Chromium that includes the fix for CVE-2026-125350, a use-after-free in Chromium's XSLT handling.
