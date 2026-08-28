---
"@qawolf/cli": minor
---

`qawolf runner run --env-id <id-or-alias>` gives a run the variables of a QA Wolf environment. QA Wolf reads and decrypts them itself, so the values never leave the server, nothing has to be pulled to disk first, and the caps that bound `--env-file` do not apply to them. That makes it the only way to run a flow whose environment holds something large, such as a session cookie.

`--env-id` and `--env-file` each give the run its whole environment, so passing both is refused before a runner is addressed rather than one silently winning.
