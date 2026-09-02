---
"@qawolf/cli": patch
---

Point the `qawolf-cli` skill's reference files at absolute raw URLs, so a harness that loads `SKILL.md` without its surrounding directory can still reach `references/runner.md` and `references/run-results.md`.
