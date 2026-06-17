---
"@qawolf/cli": patch
---

Wire `flows run --timeout` into the web flow expect timeout. Previously the flag only set Playwright's per-action timeout, so assertion failures still waited the hardcoded 30s default; it now applies to actions and assertions alike.
