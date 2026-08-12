---
name: qawolf-cli
description: Manage QA Wolf through the qawolf CLI. Use when asked which QA Wolf environment variables are available or to list, set, or delete them; manage environments, flows, runs, tags, or issues; authenticate; install; run or list flows; or drive a live cloud browser (launch a runner, screenshot it, click and type on it, read its recorder) from a shell.
license: Apache-2.0
compatibility: Requires the qawolf CLI on PATH. Install it from @qawolf/cli or use a standalone binary from GitHub Releases.
---

# QA Wolf CLI

`qawolf` runs QA Wolf flows locally, calls the QA Wolf public API, and drives
interactive runners: live cloud pods holding a browser you can see and act on.

This file is an overview, not a reference. Before first using a command whose
flags are not shown here, run `qawolf <command> --help` once. The installed CLI
is authoritative for flags and always matches its version; reuse that syntax
for the rest of the task.

## Auth

Commands that talk to QA Wolf authenticate via the `QAWOLF_API_KEY`
environment variable (or stored credentials from `qawolf auth login`).
`read` and `write` commands require auth; `local` commands do not, unless
their table entry notes a flag that switches them to `read`.
Verify with `qawolf auth whoami`. Never print or log the key.

A team API key in the environment is the whole credential, including for the
`runner` group. Nothing needs a browser login, a session token or a held
connection, so a sandbox that can set one environment variable and make
requests to one host can do everything below.

Commands use `https://app.qawolf.com` by default. Set `QAWOLF_HOST_URL` to
target another deployment host, for example
`https://app.staging.example.com`. `QAWOLF_API_URL` is a separate API endpoint
and does not select the deployment host used by CLI commands.

Resolve the target environment once per task. Use `QAWOLF_ENVIRONMENT` when it
is set; otherwise select an id or alias from
`qawolf --json environment find` and reuse it. Shell invocations may not share
exported variables, so pass the selected environment explicitly instead of
rediscovering it. Check the command's help for its environment flag: variable
commands use `--environment-id`; `qawolf flows run` uses `--env`.

If multiple environments are returned and the task context does not identify
the target, ask instead of guessing. Do not default to the newest environment.

`qawolf environment listVariableNames` intentionally returns names only. A
listed name is enough to reference `process.env.NAME` in flow code; do not ask
for its value merely because the CLI does not return it.

## Interactive runners cost money

An interactive runner is a live pod holding a browser, and it is billed while it
runs. `qawolf runner launch` starts one; `qawolf runner run` starts one too when
no runner is already available, and says so when it does. Reading a runner
counts as activity, so `qawolf runner events --follow` left open keeps it alive
and billing. `qawolf runner stop` is what ends it, so stop a runner you launched
rather than leaving it to time out.

`qawolf runner launch` remembers its runner as this directory's default, so the
commands that follow need no `--runner`. Override that default for one command
with `--runner <id>`, or for a whole session with `QAWOLF_RUNNER_ID`.

## Output

When consuming output programmatically, always pass `--json` (or `--agent`).
Human-formatted output is not stable across versions. Errors go to stderr;
a non-zero exit code means the command failed. Reuse successful read results
within a task unless a relevant write or target change could make them stale.

One exception to know about: on `qawolf runner events`, `--json` also switches
each printed line from the payload alone to the whole envelope (`sequence`,
`recordedAt`, `payload`). Both are JSON. Pass it when you want to page by
sequence, omit it when you want the payloads themselves.

Exit codes are stable and worth branching on. They are the only machine-readable
signal on a failure: error text is prose and not stable across versions.

- `0` succeeded
- `1` attempted and did not succeed: a run that failed, an action that did not
  take effect, a snippet that threw
- `2` impossible as asked: bad arguments, or a runner that can never do it
- `3` missing or invalid `QAWOLF_API_KEY`
- `4` could not be served right now, and usually worth retrying
- `5` bad `qawolf.config.ts`, a file collision during `init`, or a run file
  that could not be read
- `6` a `--follow` reached its `--timeout`: on `run`, before the run settled,
  so the run may still be going; on `events`, follow again to continue

`4` is the only one that is not self-explanatory: it covers a genuinely
transient condition and, on `exec`, a permanent one as well, so read the message
before deciding to retry.

## Safety: reads vs writes

Read commands do not change team data, but some have operational effects noted
in their command entry. Write commands act on the real team. Do not invent
configuration or write speculative values; write only when requested or when
the task requires missing configuration whose exact value is known. A
successful write response is confirmation, so do not read immediately only to
verify it. Never blind-retry a write on timeout: it may have reached the server
the first time.

Two runner-specific costs to keep in mind. Launching a runner starts a billed
pod, so reuse one id rather than minting new ones per step, and stop a runner
when you are done. And `run`, `act` and `exec` may all have taken effect even
when their answer never arrives, so none of them is safe to blind-retry; `run`
is the expensive one, because a second submission bills a second run.

## Git-backed workflows

Inspect `git status` before publishing. Stage and commit only files changed for
the current task, preserve unrelated worktree changes, then push the task's
current branch.

## Commands

<!-- commands-table:start: generated by `bun run generate`, do not edit -->

<!-- commands-table:end -->

Kinds: `read` calls the QA Wolf API without changing anything; `write`
changes team state; `local` only affects this machine. A parenthesized
note like `local (read with --remote)` means that flag makes the command
call the QA Wolf API and require auth.

## Driving a browser: the `runner` group

The `runner` commands drive a live cloud browser: `launch` one, `screenshot` to
see it, `act` to click and type, `run` a flow on it, `exec` a snippet against its
page, `events` to read its journal (including the `recorder` stream, which turns
your actions into Playwright locators), `keepalive` to hold it open, and `stop`
when done. Everything is a plain request to one host, so a shell with an API key
and its own vision model can close the see-and-act loop with no other tooling.

The full workflow is its own guide: how a runner is billed, why the first call
must be a run, the order the commands go in, the see-and-act loop, `exec`, the
recorder, reading history, staying alive, and an end-to-end example. **Read
[`references/runner.md`](references/runner.md) before driving a runner for the
first time.**
