---
"@qawolf/cli": patch
---

The managed runtime can now load `expect-webdriverio`.

The runtime installs its packages with `--legacy-peer-deps`, which does not install peer dependencies. `expect-webdriverio` needs `webdriverio`, `@wdio/globals` and `@wdio/logger` as peers, and the runtime had none of them. An import of `expect-webdriverio` stopped with `ERR_MODULE_NOT_FOUND`. The runtime now installs these three packages.

This does not yet make `expect` available in an Android flow. The runner does not start the mobile `expect`, so a flow that calls `expect` continues to fail. This change removes one of the two causes.
