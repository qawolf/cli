---
"@qawolf/cli": minor
---

Local flow runs now use Playwright 1.65.1 with `@qawolf/flows` 0.5.0 and `@qawolf/testkit` 3.0.0. Playwright 1.65.1 ships a Chromium that includes the fix for CVE-2026-125350, a use-after-free in Chromium's XSLT handling. Playwright 1.65 also changes some behavior that flows can see: actions such as `click()` and `fill()` wait for an element to stop being inert, cookie matching follows RFC 6265, proxy credentials are sent only to the proxy, text the browser does not render is no longer part of accessible names, and string or `URLSearchParams` values of an API request's `params` are appended to the URL's existing query instead of replacing it. See [Playwright 1.65's notable changes](https://github.com/microsoft/playwright/releases/tag/v1.65.0).
