---
"@qawolf/cli": minor
---

`qawolf runner actions` takes the same actions as `qawolf runner act`, including the mobile `tap`, `swipe` and `fill`. A browser runner refuses a mobile action in a sequence with `action-not-supported-on-browser`; with `--continue-on-failure` the rest of the sequence still runs. Pins `@qawolf/api-contracts` 0.81.0.
