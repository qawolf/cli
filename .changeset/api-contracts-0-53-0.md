---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.53.0`.

That release adds two contract families, and the generator adds one public-API command for each contract in them. `qawolf trigger create`, `get`, `find`, `update`, `pause`, `resume` and `delete` manage the triggers that start runs on a schedule or when a deployment is reported. `qawolf file requestUpload` and `qawolf file requestDownload` hand back a URL for putting a file into team storage and reading one back out.

`qawolf agent get` now takes `--cursor`, and answers with a `nextCursor`. Passing one check's `nextCursor` as the next check's `--cursor` returns only the replies that followed it, instead of every reply from the start of the session.

The mobile inspect contract also gained an `invalid-selector` answer, which `qawolf runner inspect` now reports by name rather than as an answer it does not recognise. No flag reaches the request that produces it yet.
