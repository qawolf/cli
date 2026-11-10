---
"@qawolf/cli": minor
---

`qawolf suggestion find`, `qawolf suggestion get` and `qawolf suggestion decide` are new. They list, read and decide the coverage QA Wolf suggests after exploring an environment: flows it wrote for missing coverage and potential bugs it found. `suggestion find --state waiting` lists the ones that need a decision.

`qawolf issue decideSuggestion` has been removed. Find the suggestion with `qawolf suggestion find` (each suggestion carries the `issueId` of the bug report or coverage request behind it), then run `qawolf suggestion decide --suggestion-id <id> --decision <decision>` with the same `--decision` and `--skip-reason` values as before.

Upgrades `@qawolf/api-contracts` to `0.132.0`, which also changes these commands. `qawolf promotion reportDecision` is new: it records how one conflicting path of a conflicted promotion was settled by running its versions, or why it is left for a person. `qawolf promotion get` and `qawolf promotion find` return those decisions and, while a conflict waits on a person, why. `qawolf run create --resolution-run-mode` takes `choose-version`, to run one version of an undecided path. `qawolf environment find` returns each environment's flow and test counts when available. `qawolf runner events` reads the new `network` stream.
