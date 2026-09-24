---
"@qawolf/cli": minor
---

`qawolf run get` takes `--flow-statuses` to return only the flows with those statuses, so a run of hundreds of flows can be read with just its failed ones. The run-results guidance starts an investigation with that filtered read. Pins `@qawolf/api-contracts` 0.68.0.
