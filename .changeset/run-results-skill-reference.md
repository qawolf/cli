---
"@qawolf/cli": minor
---

The `qawolf-cli` skill has a new reference file, `references/run-results.md`, for reading what `qawolf run get` returns. It explains the fields that a passing run does not show, such as a flow's failure diagnosis; the rules for the artifact URLs, which expire and can give a 404; and how to read the Playwright trace that `traceUrl` downloads. A trace is newline-delimited JSON, so an agent in a shell can pair each call with its result and find the failure without the trace viewer. The field list is generated from the contract, so it cannot drift from the installed version. Command help is unchanged.
