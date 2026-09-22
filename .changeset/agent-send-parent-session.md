---
"@qawolf/cli": minor
---

`qawolf agent send` forwards `QAWOLF_CHAT_SESSION_ID` as `parentSessionId` when it starts a new session, so QA Wolf lists the new session under the one that started it. Pins `@qawolf/api-contracts` 0.64.0.

The upgrade also brings `qawolf run triage`, generated from the public API.
