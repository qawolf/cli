---
"@qawolf/cli": minor
---

Add `qawolf runner screenshot`, `act`, `exec` and `keepalive`, so a caller with a shell and its own vision model can close the see-and-act loop against an interactive runner.

`qawolf runner screenshot` writes the runner's screen to a file, decoding the image on the way, and reports separately when the screen is not up yet (worth retrying) and when the runner has no screen at all (never will be). `qawolf runner act <action>` performs one raw action in the computer-use vocabulary a vision model emits, validated against the published schema before it is sent, and accepts a whole action as JSON on stdin so a model's tool call can be forwarded unchanged. `qawolf runner exec <file|->` evaluates a snippet against the live page, with `--file` to give it the scope of one of your own files; it reports whether the snippet ran, and points at the `console` stream for anything it printed. `qawolf runner keepalive` resets a runner's inactivity clock for a caller that pauses between actions.
