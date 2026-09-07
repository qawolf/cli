---
"@qawolf/cli": patch
---

The npm bundle no longer inlines the TypeScript compiler. It loads the installed `typescript` package only when `qawolf runner run` walks a flow's imports. `dist/cli.js` shrinks from 16 MB to 6.6 MB, `dist/runner-sdk.js` from 9.3 MB to 0.4 MB, and every command starts about 70 ms sooner under Node.
