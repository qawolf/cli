---
"@qawolf/cli": minor
---

`flows pull` and `flows list --remote` no longer require `--env`. When the flag is omitted, the CLI reads `QAWOLF_ENVIRONMENT`, and in an interactive terminal it otherwise lists the team's environments and prompts for a pick — auto-selecting when only one exists. Teams with both static and preview (PR) environments first pick a kind, so ephemeral PR environments don't drown out the static ones. Non-interactive runs without a flag or env var still fail with a clear error, so CI and agent behavior stays deterministic.

The `@qawolf/api-contracts` bump to 0.14.0 also adds three generated commands: `environment find`, `environment setVariable`, and `flow addTag`.
