---
"@qawolf/cli": patch
---

move appium-uiautomator2-driver to devDependencies and remove it from the managed runtime

The runtime does not load this driver from node_modules. Appium loads it from APPIUM_HOME, where `qawolf install android` installs it.

The devDependency stays so the build can read the pinned version for the APPIUM_HOME install.

This prevents lockfile churn in consumer repositories when a future driver version ships a problematic npm-shrinkwrap.json.
