---
"@qawolf/cli": minor
---

Upgrade `@qawolf/api-contracts` to `0.154.0`.

- `qawolf codingAgent submitWebhook`, `getWebhook`, `sendWebhookTest`, `rotateWebhookSecret` and `removeWebhook` manage the webhook that sends each fix to the team's own cloud coding agent. It can be a generic webhook, a Cursor automation or a Claude Code scheduled task.
- `qawolf trigger create` and `qawolf trigger update` take `--kind issue`, so a loop starts when a bug, a blocker or a coverage request changes.
- `qawolf codingAgent submitWebhook --help` and `qawolf trigger create --help` show examples, and the skill explains how to set up the webhook and the "Fix new bugs" loop.
