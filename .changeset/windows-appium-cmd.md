---
"@qawolf/cli": patch
---

Fix Android flows and the `appium` / `uiautomator2-driver` doctor checks on Windows. The CLI resolved `node_modules/.bin/appium`, the extension-less POSIX shell script that `CreateProcess` cannot execute; it now uses the `appium.cmd` wrapper npm writes next to it, paired with the `shell: true` Node requires for a batch file after CVE-2024-27980. The Android emulator had the same defect: `$ANDROID_HOME/emulator/emulator` and `$ANDROID_HOME/platform-tools/adb` now carry the `.exe` suffix on Windows, because libuv appends `.exe` only during a PATH search, never to an explicit path.
