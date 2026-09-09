---
"@qawolf/cli": minor
---

`qawolf runner launch` now says where the runner can be seen: a QA Wolf page showing its live screen, which a person can also drive with their own mouse and keyboard. It prints the address whether it started a runner or attached to one already running under that id, and so does a command that launched its own runner. `--json` carries it as `url`, and `qawolf runner list --json` carries it on every runner; the table leaves it out, since an address beside a 63-character id outgrows a terminal.

That screen plays only for the QA Wolf user that launched the runner. A runner launched with a team API key belongs to the team's automation user and shows a person the page but not the screen, so the printed line promises the screen only when you signed in through the browser.

Upgrades `@qawolf/api-contracts` to `0.52.0`, the release that adds the field. Two things come with it. The field is required on the runner responses, so this version needs a QA Wolf deployment that reports it: pointed with `QAWOLF_HOST_URL` at a host still on an older release, `runner launch` and `runner list` refuse the response. And since 0.48 every runner command accepts `workspaceId`, which the CLI fills in from the workspace a browser sign-in chose, so those commands now act in that workspace rather than the credential's default. That release also adds the `email.registerAddress` and `run.stop` endpoints, so `qawolf email registerAddress` and `qawolf run stop` join the generated public-API commands.
