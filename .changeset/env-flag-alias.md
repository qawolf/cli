---
"@qawolf/cli": minor
---

Accept `--env` and `--environment-id` interchangeably on every command that takes an environment. `qawolf run create --env <env_id>` now works, as does `qawolf flows run --environment-id <env_id>`. Help text and docs promote `--env`; `--environment-id` stays supported.
