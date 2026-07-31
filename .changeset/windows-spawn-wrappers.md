---
"@qawolf/cli": patch
---

Fix `ENOENT` when the CLI spawns npm, Appium, or the Android SDK tools on Windows. `qawolf flows run` failed while preparing the environment. `qawolf doctor` reported npm and `appium` as not installed, even though both worked in the same shell. `qawolf install android` could not reach `sdkmanager` or `avdmanager`. Windows ships these tools as `.cmd` or `.bat` wrappers and ships no `.exe` alternative. Node's process spawn cannot execute a batch file directly. The CLI now names the wrapper file and runs it through `cmd.exe /d /s /c` with quoted arguments. The `adb` and `emulator` paths built from `ANDROID_HOME` now name the `.exe` suffix directly instead of relying on the spawn path search. Running the CLI inside WSL is unaffected, because it reports itself as Linux and carries POSIX tools.
