---
"@qawolf/cli": patch
---

`qawolf install android` now installs the uiautomator2 driver at 4.2.9 rather than 3.7.0, which carries patched `body-parser`, `cross-spawn`, `path-to-regexp` and `brace-expansion`. The driver pins those itself through a bundled `npm-shrinkwrap.json`, so bumping the driver is the only thing that can move them.

A machine that already has the driver keeps the version it has, because `install android` skips the step whenever a uiautomator2 driver is present. Updating it by hand needs `APPIUM_HOME` pointed at the CLI-managed Appium home — a bare `appium driver update` would update your default `~/.appium` instead and leave the CLI still on 3.7.0:

```bash
# macOS
APPIUM_HOME="$HOME/Library/Application Support/qawolf-nodejs/appium" \
  appium driver update uiautomator2
# Linux
APPIUM_HOME="$HOME/.local/share/qawolf-nodejs/appium" \
  appium driver update uiautomator2
```

`qawolf doctor` only checks that a uiautomator2 driver is present, so it passes on 3.7.0 too. To confirm the version, run `appium driver list --installed` with the same `APPIUM_HOME`.
