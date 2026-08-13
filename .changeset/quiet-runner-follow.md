---
"@qawolf/cli": minor
---

`qawolf runner run --follow` now reports only the run's status — an "in progress" line, then whether it passed or failed — instead of streaming every log line the run produces. The full log stream is available behind the new `--logs` flag, and two more flags mirror further streams into the follow as JSON lines: `--run-events` for the run's progress events and `--recorder-events` for the browser actions the runner records from submission on. Each stream flag implies `--follow`. Anything parsing a followed run's stdout should expect at most one in-progress status entry by default and read the outcome from the exit code; pass `--logs` to keep receiving log lines, and follow one stream flag at a time when parsing — combined mirrors interleave without a stream label.
