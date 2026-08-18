---
"@qawolf/cli": patch
---

Android and iOS flows no longer stop with `ERR_MODULE_NOT_FOUND` when the runtime starts.

The managed runtime installs its packages with `--legacy-peer-deps`, which does not install peer dependencies. `expect-webdriverio` needs `webdriverio`, `@wdio/globals` and `@wdio/logger`, and the runtime had none of them. `import("expect-webdriverio")` stopped with `ERR_MODULE_NOT_FOUND`, so each mobile flow failed when `configureFlowRuntime` started the mobile `expect`.

The managed runtime now installs these three packages.
