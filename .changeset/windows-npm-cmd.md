---
"@qawolf/cli": patch
---

Fix `spawn npm ENOENT` on Windows. `flows run` failed while preparing the environment and `qawolf doctor` reported "npm is not installed or not on PATH", even though `npm --version` worked in the same shell. Windows ships npm as `npm.cmd` and has no `npm.exe`, and libuv's spawn PATH search ignores `PATHEXT` and only appends `.com`/`.exe` — so the bare name `npm` never resolved, while cmd.exe found it because cmd.exe does apply `PATHEXT`. The CLI now spawns `npm.cmd` with `shell: true` on Windows, which is also the pairing Node requires to execute a batch file after CVE-2024-27980. WSL is unaffected: it reports `linux` and carries a POSIX npm.
