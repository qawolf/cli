---
"@qawolf/cli": patch
---

Skip `runner.performAction` in the generated public API commands. An upcoming `@qawolf/api-contracts` version adds this contract, and its action-union input has no flag form; without the skip, upgrading the dependency would make command generation throw while the program is built, breaking every command. The verb will get a hand-written command instead.
