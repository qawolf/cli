---
"@qawolf/cli": patch
---

Exit `flows run` deterministically once the run completes. The flow runtime can launch browser processes (e.g. a channel-launched Google Chrome) whose CDP sockets and timers keep Node's event loop alive after teardown, so the CLI previously printed its results and then hung indefinitely. The process now flushes stdout/stderr and exits with the run's exit code (1 on flow failure, 0 on pass) as soon as the command resolves, with a backstop in case a stream stalls.
