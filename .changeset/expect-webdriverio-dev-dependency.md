---
"@qawolf/cli": patch
---

`npx @qawolf/cli` and `npm install @qawolf/cli` no longer stop responding.

The CLI pinned `expect-webdriverio` 5.6.5 as a dependency. `@wdio/globals` 9.31.0 then started to require `expect-webdriverio` 6.0.5 or later. npm cannot obey both rules, and it does not report an error. It searches instead, and the install can run for more than 30 minutes.

`expect-webdriverio` is now a development dependency. The CLI does not import it, so nothing changes when you run a flow.
