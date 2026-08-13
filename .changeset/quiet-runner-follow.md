---
"@qawolf/cli": minor
---

`qawolf runner run --follow` now reports only the run's status — an "in progress" line, then whether it passed or failed — instead of streaming every log line the run produces. The full log stream is available behind the new `--logs` flag, which implies `--follow`. Anything parsing a followed run's stdout should expect status entries by default and pass `--logs` to keep receiving log lines.
