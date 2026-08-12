---
"@qawolf/cli": minor
---

Add `qawolf runner`, a command group for driving an interactive runner on the QA Wolf platform.

`qawolf runner launch` starts one and makes it this directory's default; `qawolf runner stop` stops it. `qawolf runner run <file>` ships the current directory's runnable files and runs a flow on the runner, and with `--follow` streams the run's logs until the run settles. `qawolf runner events <stream>` prints a runner's journal one entry per line, so `--tail`, `--since`, `--run` and `--follow` compose with `grep` and `jq`; `--json` prints the whole envelope. Every `--follow` is bounded by `--timeout` (an hour by default), because reading a runner keeps it alive and billing.

Runner-targeting commands take an optional `--runner <id>`, falling back to `QAWOLF_RUNNER_ID` and then to the runner stored for the directory. A command with no runner available launches one and says so, naming it, so a caller knows the browser it is now driving is fresh. A launch that fails still names the runner it was launching, because a launch whose answer was lost may have started one: relaunching that same id attaches to it rather than starting a second.

Under `--json`, and so in CI, a followed run's logs are printed as journal entries rather than as bare text, which keeps everything the command writes to stdout parseable as one stream.
