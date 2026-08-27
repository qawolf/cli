---
"@qawolf/cli": patch
---

`qawolf runner run --lines --lines-file <path>` no longer fails when the named file has not changed since the last run on that runner.

Delta shipping withholds a file whose content hash matches what the runner already holds, so an untouched page object was dropped from the payload and the platform refused the run with `A selection must name a file carried in files.` The selection's file now always travels in full, alongside the entry point and `package.json`.
