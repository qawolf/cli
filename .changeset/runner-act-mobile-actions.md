---
"@qawolf/cli": minor
---

`qawolf runner act` has mobile actions of its own: `tap` (at `--x`/`--y` or on a `--selector`), `swipe` (`--from x,y --to x,y`, optional `--duration-ms`), and `fill` (replaces the value of the `--selector` field with `--text`). `click` and `drag` still tap and swipe on a mobile runner, but are deprecated there. A browser runner refuses the mobile actions with `action-not-supported-on-browser`. Pins `@qawolf/api-contracts` 0.73.0.
