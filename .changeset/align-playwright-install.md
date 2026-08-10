---
"@qawolf/cli": patch
---

Align browser install and doctor with the pinned playwright runtime. The CLI shipped an unused `@playwright/test` dependency, and user projects can install their own copy at any version. Both packages declare a `playwright` bin, and either can win the `node_modules/.bin/playwright` shim. When the shim belongs to a different version than the pinned `playwright`, `install browsers` downloads browser builds for the wrong playwright version. The flow runtime imports the `playwright` module, so it could not launch the installed builds. This change removes the `@playwright/test` dependency. `install browsers`, `doctor`, and runtime-dir validation now run the `playwright` package's own `cli.js` through the CLI's runtime, so the installed builds always match the runtime. `doctor` now also fails with a clear message when the installed playwright version differs from the pinned runtime version.
