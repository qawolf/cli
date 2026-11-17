---
"@qawolf/cli": minor
---

Upgrade `@qawolf/api-contracts` to `0.142.0`.

- `qawolf issue requestFix` hands a bug report to the team's own coding agent, which fixes it in the team's CI. A QA Wolf session that a loop started calls it when the loop's instructions use `/coding-agent`.
- `qawolf issue markFixReadyForReview` marks the draft pull request of a bug's fix ready for review.
- `qawolf issue retryFix` asks the team's coding agent for one more try at a bug that the check of its fix still shows.
- `qawolf trigger create` and `qawolf trigger update` take `--description` and `--is-paused`, and a trigger's action can start a QA Wolf session with instructions.
- `run get` documents `flows[].attempts[].networkLogsUrl`, the signed URL of an attempt's iOS network log.
