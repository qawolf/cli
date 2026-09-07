---
"@qawolf/cli": patch
---

The npm package no longer bundles webdriverio and the rest of the mobile stack. Mobile runs load it from the managed runtime that is installed on first use. `dist/cli.js` shrinks from 6.6 MB to 1.1 MB and every command starts about 25 ms sooner under Node. The compiled binary is unchanged.
