---
"@qawolf/cli": patch
---

The `QAWOLF_RUNNER_ID` shadow warning added in the previous release no longer suggests `export QAWOLF_RUNNER_ID=<launchedId>` as a fix, since that repoints every other runner-less command too rather than just the one you meant; `--runner <launchedId>` is the only fix it now names. `references/runner.md` documents the new warning alongside the resolution order it stems from.
