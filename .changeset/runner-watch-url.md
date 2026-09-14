---
"@qawolf/cli": minor
---

`qawolf runner launch` now says where the runner can be seen: a QA Wolf page showing its live screen, which a person can also drive with their own mouse and keyboard. A freshly launched runner has no screen yet — the page waits until the runner's first run starts one. It prints the address whether it started a runner or attached to one already running under that id, and so does a command that launched its own runner. `--json` carries it as `url`, and `qawolf runner list --json` carries it on every runner; the table leaves it out, since an address beside a 63-character id outgrows a terminal.

The page opens for anyone on the runner's team, however the runner was launched, so the address is worth handing to a colleague who asks what your runner is doing.
