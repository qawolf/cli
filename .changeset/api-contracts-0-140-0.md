---
"@qawolf/cli": minor
---

Upgrade `@qawolf/api-contracts` to `0.140.0`.

- A trigger is what the app calls a loop. `qawolf trigger create` and `qawolf trigger update` take `--action-kind startAgent` with `--action-instructions` to start a QA Wolf session when the trigger fires, what the app calls Run AI, plus `--description` and `--is-paused`.
- `qawolf trigger runNow` fires a trigger once by hand, and `qawolf trigger listFirings` lists when it fired and what each firing started.
- `qawolf trigger create --is-paused` and `qawolf trigger update --is-paused` check that the server reports the trigger paused. A server that does not support `isPaused` yet ignores it and leaves the trigger running, so the CLI pauses it with `qawolf trigger pause` and exits with an error that says so. When that pause fails, the error says the trigger is live and how to pause it.
- A command the server does not serve yet, such as `qawolf trigger runNow` against an older server, says that the server does not support it yet instead of reporting a missing record.
- `qawolf usage breakdown` shows where credits went over a range of days.
- `qawolf codeHostIntegration findForRepository` checks whether QA Wolf can read a repository through the workspace's code host integrations.
