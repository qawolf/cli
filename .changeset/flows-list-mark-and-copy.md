---
"@qawolf/cli": minor
---

Mark flows with Tab in the interactive list, keeping marks across searches. Ctrl-Y copies paths and Ctrl-O copies IDs for marked flows, or the highlighted flow when none are marked. Enter prints marked flows, or all matches when none are marked. Missing IDs produce a notice.

Copied paths are separate literal shell arguments using POSIX syntax on macOS/Linux and PowerShell syntax on Windows. The CLI uses system clipboard tools and falls back to requesting the terminal clipboard when tools are unavailable.
