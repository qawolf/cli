---
"@qawolf/cli": patch
---

`qawolf install android` now installs the uiautomator2 driver at 4.2.9 rather than 3.7.0, which carries patched `body-parser`, `cross-spawn`, `path-to-regexp` and `brace-expansion`. The driver pins those itself through a bundled `npm-shrinkwrap.json`, so bumping the driver is the only thing that can move them.

A machine that already has the driver keeps the version it has, because `install android` skips the step whenever a uiautomator2 driver is present. Run `appium driver update uiautomator2` there to pick this up.
