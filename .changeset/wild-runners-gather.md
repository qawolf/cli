---
"@qawolf/cli": minor
---

Add `qawolf runner`, a command group for driving an interactive runner on the QA Wolf platform.

`qawolf runner launch` starts one and makes it this directory's default; `qawolf runner stop` stops it. `qawolf runner run <file>` ships the current directory's runnable files and runs a flow on the runner, and with `--follow` streams the run's logs until the run settles. `qawolf runner events <stream>` prints a runner's journal one entry per line, so `--tail`, `--since`, `--run` and `--follow` compose with `grep` and `jq`; `--json` prints the whole envelope.

Runner-targeting commands take an optional `--runner <id>`, falling back to `QAWOLF_RUNNER_ID` and then to the runner stored for the directory. A command with no runner available launches one and says so, naming it, so a caller knows the browser it is now driving is fresh.
