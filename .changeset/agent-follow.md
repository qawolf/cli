---
"@qawolf/cli": minor
---

`qawolf agent send` and `qawolf agent get` are now hand-written commands with a `--follow` flag. With `--follow`, the command stays attached to the session. It prints each reply once, as it arrives. It exits when the session settles: 0 for completed, non-zero for failed or cancelled.

A followed session can ask a question. In a terminal, the CLI shows the question and asks for an answer. It offers a list when the AI gives a fixed set of answers, and free text when it does not. It sends the answer to the same session and continues to follow. In a pipe, a CI job or agent mode, the CLI prints the question and the command that answers it, then exits 0.

In `--json` and `--agent` mode, a follow ends with one line that holds the whole session object. This is the same object `qawolf agent get` answers with. A script can read the final status, the session id and the url from stdout.

`qawolf agent send` remembers the session it starts. A later `qawolf agent get --follow` in the same directory needs no id. `--session <id>` and `QAWOLF_SESSION_ID` name a different session. `--timeout` sets how long a follow waits. The default is 30 minutes.

Two flags changed name from the generated commands in 1.23.0. The message is now the first argument of `agent send`, not `--message`. `--session-id` is now `--session` on both commands. `--environment-id` still reads `QAWOLF_ENVIRONMENT`, and `--workspace-id` is still available for a credential that is not bound to one workspace.

The QA Wolf platform reports only that a session is at work. A follow prints each reply as it arrives and shows a wait line between them. It shows more when the platform reports more.
