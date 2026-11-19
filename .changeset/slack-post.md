---
"@qawolf/cli": minor
---

`qawolf slack post --channel <id> --text <text> [--thread <ts>]` posts a message, or a reply in a thread, in one of the workspace's own Slack channels as the QA Wolf agent. Only a QA Wolf session that a loop started can post. It prints the message's link, and when QA Wolf refuses the post it says why and exits non-zero.
