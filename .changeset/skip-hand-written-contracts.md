---
"@qawolf/cli": patch
---

Skip public-API command generation for contracts served by hand-written commands, so a future `flow.list` contract does not mint a duplicate of `qawolf flows list --remote`.
