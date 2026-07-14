---
"@qawolf/cli": minor
---

`flows list --remote` is now environment-scoped via the QA Wolf public API: pass `--env <env>` (now required with `--remote`) and optionally `--include-drafts` to include draft flows. JSON output now emits `flowId` instead of `id` for each flow.
