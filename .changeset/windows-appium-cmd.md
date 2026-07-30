---
"@qawolf/cli": patch
---

Fix Android flows and the `appium` / `uiautomator2-driver` doctor checks on Windows. The CLI resolved `node_modules/.bin/appium`, which is the extension-less POSIX script. Windows cannot execute that file. The CLI now uses the `appium.cmd` wrapper npm writes beside it, with the `shell: true` Node requires for a batch file after CVE-2024-27980. `qawolf install android` gets the same fix for the `sdkmanager.bat` and `avdmanager.bat` wrappers in cmdline-tools. The `adb` and `emulator` paths built from `ANDROID_HOME` now name the `.exe` suffix directly instead of relying on the spawn path search.
