---
"@qawolf/cli": minor
---

Upgrade `@qawolf/api-contracts` to `0.135.0`.

- `qawolf promotion askQuestion` asks a person about a conflicting path that QA Wolf left for a person: a question about the app, both versions as plain steps with how each ran, the possible answers and QA Wolf's pick.
- `qawolf promotion answerQuestions` answers every question of a promotion's current conflict at once and hands the promotion back to QA Wolf, which updates the flows the way they were answered and promotes them.
- `qawolf promotion get` returns the promotion's questions and their answers, and a needs-person decision names the question asked about it.
- `qawolf promotion reportDecision` records a needs-person decision with no runs when the workspace runs no versions but has promotion questions on.
