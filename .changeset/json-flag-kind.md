---
"@qawolf/cli": minor
---

Generated commands now accept a top-level input that holds a list of objects as one JSON value, e.g. `--changes '{"items":[...]}'`. The value is checked against the command's input before anything is sent, and invalid JSON gets a clear error.
