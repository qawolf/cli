---
"@qawolf/cli": minor
---

Upgrades `@qawolf/api-contracts` to `0.40.0`.

That release adds three endpoint contracts. The generator adds one public-API command for each contract. `qawolf agent send` tells the QA Wolf AI to do work, in plain language. `qawolf agent get` reads the replies from that work and shows its status. `qawolf run diagnose` records the failed flows of a run as reproductions of a bug report or a maintenance report.

The release also changes the description of `qawolf issue addFlows`. The new description points to `run.diagnose` for bug reports and maintenance reports.
