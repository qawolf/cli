---
"@qawolf/cli": minor
---

Every `qawolf runner` command takes `--workspace-id <id>`, which works in that workspace for the one command without saving it. Until now the only way to choose a runner's workspace was `qawolf auth switch`, which saves the choice for every session on the machine, so one session switching moved every other session's next runner command to the new workspace. Without the flag, runner commands still use the saved workspace. The flag also gives an organization or user API key, which saves no workspace, one to work in.
