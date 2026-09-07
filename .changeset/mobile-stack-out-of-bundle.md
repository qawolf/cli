---
"@qawolf/cli": patch
---

The npm bundle no longer inlines webdriverio and the rest of the mobile stack. Mobile runs load webdriverio from the managed runtime that `ensureDeps` already installs on first use, the same way `@qawolf/emails` and `@qawolf/testkit` are loaded. `dist/cli.js` shrinks from 6.6 MB to 1.1 MB and every command starts about 25 ms sooner under Node. The compiled binary is unchanged.
