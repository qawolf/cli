---
"@qawolf/cli": patch
---

Fix a crash in the exit path when a command fails before the log file opens (a "sonic boom is not ready yet" stack trace printed after the error message). The log fd now opens eagerly at creation while writes stay asynchronous.
