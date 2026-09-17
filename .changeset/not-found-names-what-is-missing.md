---
"@qawolf/cli": minor
---

A 404 from the QA Wolf API now names what the command could not find, instead of telling everyone to check `--env`. A runner-targeting command says the runner is not running, names it, says whether `--runner`, `QAWOLF_RUNNER_ID` or this directory's stored default chose that id, and gives the launch command. `qawolf run get` says there is no such run on this team, and that ids printed by `qawolf runner run` are the runner's own — read those with `qawolf runner events run-status --run <id>`. Only a request that really is scoped to an environment still points at `--env`.

A failed `@qawolf/cli/runner-sdk` call now carries that second line as `errorDetail`, which the SDK used to build and throw away.

These failures now exit `8` rather than `4`. Exit `4` means retry; a runner that was terminated or idled out never comes back, so a caller that kept retrying burned its budget on an id that could not work. Bound your retries on `4` as before, and stop on `8`.
