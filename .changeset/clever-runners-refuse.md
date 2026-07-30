---
"@qawolf/cli": patch
---

`qawolf runner screenshot` no longer launches a runner when none is available, and `qawolf runner exec` no longer blames the wrong thing when there is no page yet.

A runner's virtual desktop starts with its first run, so a runner launched to serve a screenshot had no screen and the command reliably answered `screen-not-ready`: a billed pod in exchange for an error. It now says what to do instead, which is to launch a runner and open a page on it. This also makes one rule true across the group: no `read` command starts a runner, so only `run`, `act` and `exec` ever do.

`qawolf runner exec` against a runner with no live page used to suggest checking whether the runner runs a browser at all. On a freshly launched `node20WithPlaywright` runner that is the wrong thing to check, since it does run one and simply has no page open yet; the message now says to run a flow on it or navigate it first, and keeps the never-clears case as the secondary possibility.
