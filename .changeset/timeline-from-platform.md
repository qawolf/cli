---
"@qawolf/cli": minor
---

`qawolf attempt inspect --timeline` asks QA Wolf for the action timeline instead of downloading and parsing the trace, so attempts with a trace too large to download have a timeline too, and the answer matches the QA Wolf MCP's. `--before-action <id>` reads the page before an action, using the `nextBeforeActionId` the previous page returned. A trace past its retention now answers `traceStatus: "expired"`.
