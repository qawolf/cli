---
"@qawolf/cli": minor
---

`qawolf runner highlight-selector [selector]` draws on a runner's live page so the next screenshot shows what a selector matches. Omit the selector to clear it. A selector the page read but that matched nothing exits `0` and reports the count, while one the page could not read at all exits `2`, so a bad locator is told apart from a locator pointing at nothing.

`qawolf runner promote-snapshot --screenshot <path> --baseline <path>` accepts a run's screenshot as the new baseline for an image diff, on the runner that produced it. Both paths are the ones the diff reported on the `run-events` journal stream.
