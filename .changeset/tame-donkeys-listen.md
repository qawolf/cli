---
"@qawolf/cli": minor
---

`qawolf flows run` now exits 2 when the pattern selects nothing runnable. It previously exited 0, so a typo'd pattern or a mis-scoped CI shard reported success with no flow executed. Three cases changed: the pattern matches no file, the matched files declare no `target`, and every matched flow has a target the CLI cannot run locally (iOS, Basic, Electron). The `--env` path already exited 2 for its own no-match case.

Pass `--allow-no-match` to keep the old exit-0 behavior where an empty selection is expected.
