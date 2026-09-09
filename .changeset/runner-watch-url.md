---
"@qawolf/cli": minor
---

`qawolf runner launch` now says where to watch the runner: a QA Wolf page showing its live screen. It prints the address whether it started a runner or attached to one already running under that id, and `--json` carries it as `url`. `qawolf runner list --json` carries the same `url` on every runner; the table leaves it out, since an address beside a 63-character id outgrows a terminal.

The live screen authorizes the QA Wolf user that launched the runner. A runner launched with a team API key belongs to the team's automation user, so a person opening the page sees the runner but not its screen.

Upgrades `@qawolf/api-contracts` to `0.52.0`, the release that adds the field. That release also adds the `email.registerAddress` and `run.stop` endpoints, so `qawolf email registerAddress` and `qawolf run stop` join the generated public-API commands.
