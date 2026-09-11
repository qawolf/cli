---
"@qawolf/cli": minor
---

`qawolf runner inspect elements` can now find elements by a hand-written selector: `--selector "<selector>" [--strategy xpath|ios-predicate|shadow]` (strategy defaults to `xpath`), alongside the existing `--x`/`--y` and `--text`/`--partial`. This is the mobile equivalent of `inspect element-html --selector` on a browser runner — the only way before this was injecting a `console.log` via `runner exec` and reading the count back out of `runner events console`. An unparseable selector answers `invalid-selector`, distinctly from a selector that parsed fine but matched nothing (an empty `matches` list) — the same distinction `highlight-selector` draws on a browser runner. `--by` is no longer a flag: which of the three you gave is now evident from which flags are present, and the three refuse to mix.

Requires `@qawolf/api-contracts@^0.53.0`.
