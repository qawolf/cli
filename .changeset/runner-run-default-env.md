---
"@qawolf/cli": patch
---

`qawolf runner run` now falls back to `QAWOLF_ENVIRONMENT` when neither `--env-id` nor `--env-file` is passed, so the one export that already sets a default for `qawolf flows` covers a runner run too. `--env-id` still wins over it, and `--env-file` suppresses it so a run reading a dotenv file is not handed a second environment on top.

The run reports on stderr which environment it picked up. A run that was given none before is now given one, and those variables reach the flow's code, so it should never happen silently.
