---
"@qawolf/cli": patch
---

Stop emitting a `DeprecationWarning` on Windows. Under Node 25, `qawolf doctor` and `qawolf flows run` printed Node's DEP0190 warning on every run. Windows needs cmd.exe to run a `.cmd` file, and the CLI asked for it with `shell: true`. Node 25 deprecates that flag when the caller also passes an argument array. The CLI now invokes `cmd.exe /d /s /c` itself and quotes the arguments.
