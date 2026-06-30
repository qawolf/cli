---
"@qawolf/cli": patch
---

Resolve flow imports whose specifier uses a `.ts` extension but ships as `.js` (and vice versa). Platform-generated bundles often import sibling utilities as `.ts` while the file on disk is `.js`; native Node ESM resolves extensions literally and throws `ERR_MODULE_NOT_FOUND`. A synchronous `module.registerHooks` resolve hook now transparently retries the sibling source extension (`.ts`↔`.js`, `.mts`↔`.mjs`, `.cts`↔`.cjs`) only on resolution failure — literal matches always win and nothing is rewritten on disk. Raises the Node engine floor to `>=22.15.0`, the release that introduced synchronous hooks.
