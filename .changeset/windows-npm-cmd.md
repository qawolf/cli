---
"@qawolf/cli": patch
---

Fix `spawn npm ENOENT` on Windows. `flows run` failed while preparing the environment, and `qawolf doctor` reported "npm is not installed or not on PATH". Both failed even though `npm --version` worked in the same shell. Windows ships npm as `npm.cmd` and has no `npm.exe`, which Node's process spawn requires. The CLI now runs `npm.cmd` on Windows. WSL is unaffected, because it reports itself as Linux and carries a POSIX npm.
