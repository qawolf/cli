---
"@qawolf/cli": patch
---

Resolve environment aliases before flows commands use them. `flows pull --env <alias>` and `flows run --env <alias>` failed with an HTTP 400 because the CLI sent the alias to an endpoint that requires an environment id. The CLI now resolves an explicit `--env` value, and a `QAWOLF_ENVIRONMENT` value, through the `environment.get` public API. That endpoint accepts an id or an alias and returns the canonical id. Only the id goes to later requests, so `--env <alias>` and `--env <id>` now write to the same `.qawolf/<id>/` cache directory. When the resolution fails, the error names the environment value and tells you that aliases require a team API key.
