---
"@qawolf/cli": minor
---

The CLI now checks the npm registry for a newer published version while a command runs. After the command completes, the CLI shows an update notice one time for each new version. Human mode shows a styled note. Agent mode writes plain text to stderr. JSON mode writes a note diagnostic to stderr and does not change stdout. Set QAWOLF_NO_UPDATE_CHECK=1 to disable the check.
