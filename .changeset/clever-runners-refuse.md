---
"@qawolf/cli": patch
---

`qawolf runner screenshot` asks for a runner that already has a screen instead of starting one, and `qawolf runner exec` names the missing page rather than the runner's image.

A runner's virtual desktop starts with its first run, so a runner launched to serve a screenshot would have no screen and could only answer `screen-not-ready`. `screenshot` refuses instead, and names both things it needs: a runner, and a run on it. That also keeps the group readable, because no `read` command starts a runner.

A `node20WithPlaywright` runner with no live page does run a browser and simply has nothing open on it yet, so `qawolf runner exec` points at the page rather than at the runner's image. Checking the image stays as the secondary possibility, since it is the case that never clears.
