---
"@qawolf/cli": patch
---

remove the unused appium-xcuitest-driver dependency

The CLI does not support iOS targets, so it never installs, loads, or resolves this driver.

The driver ships a bundled npm-shrinkwrap.json that makes npm write 41 extraneous entries into the package-lock.json of consumer repositories on each install.

The managed runtime environment now installs approximately 430 fewer packages.
