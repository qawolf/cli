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

A `--json` response shows you most of its own shape, so read it first.

`qawolf run get` is the exception worth reading about before you use it. Its
artifact URLs expire, its failure fields are absent from a passing run, and its
`traceUrl` downloads a Playwright trace that you can read as JSON without
opening the trace viewer. **Read
[`references/run-results.md`](references/run-results.md) before reporting on a
run's outcome or opening its trace.**

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

<!-- commands-table:start — generated by `bun run generate`, do not edit -->

<!-- prettier-ignore -->
| Command | Kind | What it does |
| --- | --- | --- |
| `qawolf auth login` | local | Authenticate with your QA Wolf API key |
| `qawolf auth logout` | local | Remove stored credentials |
| `qawolf auth whoami` | read | Show authentication status |
| `qawolf automate` | write | Request automation for draft flows. First create a named local .flow.ts draft for every requested journey that does not already have a matching draft; never reuse a generic starter or placeholder. Each new draft must start with a JSDoc Goal: description, import flow from @qawolf/flows/web, and use export default flow(...); a comment-only file or direct test(...) call is not a valid draft. Commit and push all changes with Git to publish them, then list remote drafts to resolve every selected ID. Do not use patch to create or rename a selected flow. Finally make one automation request containing all requested flow IDs. |
| `qawolf doctor` | local | Diagnose problems running flows locally |
| `qawolf environment create` | write | Create an environment on the caller's team and return it in the environment.get shape. |
| `qawolf environment deleteVariable` | write | Remove one environment variable by name. Succeeds whether or not the variable existed. |
| `qawolf environment find` | read | List the team's environments, newest first. |
| `qawolf environment get` | read | Read a single environment's name, kind, health status, run concurrency limit, and termination state. |
| `qawolf environment getVariable` | read | Read the values of named environment variables in one call. Values are secrets. Names that do not exist go to missingNames and do not fail the call. |
| `qawolf environment listVariableNames` | read | Use this to answer which QA Wolf environment variables are available to test code. Returns names only; values never leave the server. |
| `qawolf environment setVariable` | write | Create or replace an environment variable. If the user asks to create one for "my email" without naming it, use DEFAULT_EMAIL. The value is never returned. |
| `qawolf environment update` | write | Update an environment owned by the caller's team and return it in the environment.get shape. Omitted fields remain unchanged. |
| `qawolf flow addTag` | write | Assign an existing tag to the selected flows. Create tags with tag.create. |
| `qawolf flow update` | write | Move a flow between draft and active readiness. The other statuses shown in the app are derived and cannot be set. |
| `qawolf flows list` | local (read with --remote) | List flows matching [pattern] from the local project, or from a QA Wolf environment with --remote |
| `qawolf flows pull` | read | Download an environment's flows into the local .qawolf/<env>/ cache |
| `qawolf flows run` | local (read with --env) | Run flows matching [pattern], or every flow when omitted; with --env, pull missing flows from that QA Wolf environment |
| `qawolf init` | local | Scaffold a QA Wolf project in the current directory |
| `qawolf install` | local | Install every runtime dependency the project's flows need |
| `qawolf install android` | local | Install Android system images, AVDs, and the Appium driver used by the project's Android flows |
| `qawolf install browsers` | local | Install Playwright browsers used by the project's web flows |
| `qawolf install clear` | local | Remove the managed runtime cache (all installed runtime versions) |
| `qawolf issue create` | write | Create a bug or coverage request issue for the caller's team. Maintenance issues cannot be created through the public API. |
| `qawolf issue find` | read | List the team's bug reports, maintenance reports, or coverage requests, newest first. |
| `qawolf issue get` | read | Get an issue by id. |
| `qawolf run create` | write | Create a run for the selected flows and/or tags in an environment. |
| `qawolf run find` | read | List an environment's recent runs, newest first. |
| `qawolf run get` | read | Get a run's status, per-flow results, and links. |
| `qawolf runner act` | write | Perform one raw action on a runner's screen: click, double_click, scroll, move, drag, keypress, navigate or type. Use - to read a whole action as JSON from stdin |
| `qawolf runner events` | read | Print a runner's journal, one entry per line. QA Wolf writes console, recorder, run-events, run-logs, run-status |
| `qawolf runner exec` | write | Evaluate a snippet against a runner's live page. Use - to read the snippet from stdin |
| `qawolf runner keepalive` | read | Reset a runner's inactivity clock, for a caller that pauses between actions |
| `qawolf runner launch` | write | Launch an interactive runner and make it this directory's default |
| `qawolf runner run` | write | Run a flow on an interactive runner, shipping the current directory's files with it |
| `qawolf runner screenshot` | read | Save a JPEG of an interactive runner's screen to a file |
| `qawolf runner stop` | write | Stop an interactive runner |
| `qawolf tag create` | write | Create a tag on the caller's team. Tags select flows in run.create. |
| `qawolf tag list` | read | List the team's tags, alphabetical by name. Tag names select flows in run.create. |

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
