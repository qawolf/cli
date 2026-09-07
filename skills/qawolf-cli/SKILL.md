---
name: qawolf-cli
description: Manage QA Wolf through the qawolf CLI. Use when asked to create, update, or list coverage requests, bug reports, or maintenance reports; start a run of flows or tags on the QA Wolf platform or read a run's results; list, set, or delete environment variables; manage environments, flows, or tags; request automation of draft flows; run or list flows locally; authenticate; install the local runtime; or drive a live cloud browser (launch a runner, screenshot it, click and type on it, read its recorder) from a shell.
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
commands use `--environment-id`; `qawolf flows run` uses `--env`; and
`qawolf runner run` uses `--env-id`, which falls back to `QAWOLF_ENVIRONMENT`
when neither it nor `--env-file` is passed.

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
and billing. `qawolf runner terminate` is what ends it, so terminate a runner you launched
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
run's outcome or opening its trace.** If that path is not on your filesystem,
fetch it:
`https://raw.githubusercontent.com/qawolf/cli/main/skills/qawolf-cli/references/run-results.md`.

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

The platform reads flows from the environment's flow code branch, not from your
task branch. `qawolf --json environment get` reports it as `flowCodeBranch`
(`name`, `syncStatus`, `lastSyncedCommitHash`). A flow has a platform page, an
id, and a place in `qawolf flows list --remote` only once it is on that branch
and the environment has reconciled the commit. To link or run a new flow on the
platform: integrate the flow code branch into your work, push the flow to that
branch, poll `environment get` until `lastSyncedCommitHash` includes your
commit, then read the flow's `flowId` and `url` from
`qawolf --json flows list --remote --env <environment> --include-drafts`. Send
that `url`; never guess a route and never send a repository link in its place.

## Commands

<!-- commands-table:start — generated by `bun run generate`, do not edit -->

<!-- prettier-ignore -->
| Command | Kind | What it does |
| --- | --- | --- |
| `qawolf agent get` | read | Monitor a QA Wolf AI session by reading its status and replies. After agent.send, share the returned session URL before monitoring. Wait 30 to 60 seconds between checks; do not call this in a tight loop. Replies accumulate, so compare them with what you have already seen. Continue monitoring silently when the status and replies are unchanged; do not narrate waiting, announce the next check, or ask whether to keep monitoring. Report only substantive new progress, questions, blockers, or the final outcome. A status of "waiting-for-you" means the last reply is a question the work is blocked on, and answering it with agent.send is what unblocks it. Surface an explicit request for user input even if the status still says "working". Include the session URL when reporting a blocker or final outcome. On "completed", stop status checks and verify the requested result before claiming success. For new flows, validation, publication in the target environment, and readiness are separate checks; a Git push or final reply does not prove the flow is active. If every requested result is verified but status remains "working", report the mismatch and stop monitoring. Stop on "failed" or "cancelled" and report any confirmed partial result. |
| `qawolf agent send` | write | Start or continue work with the QA Wolf AI and return a live session URL to share with the user. Use it to cover a user journey, investigate a failing run, or fix a broken flow. This is the one verb that starts work from nothing: every other write acts on a flow, run or issue that already exists. Returns sessionId, status, and url as soon as the request is accepted; work can take minutes to tens of minutes. After each send, make the next action a normal user-visible assistant message containing the exact returned url, before any tool call or wait. Tool output and internal reasoning do not count as sharing the link. Do not run a timer or monitoring call alongside this send. Acceptance does not mean the work is complete. Then monitor the session with agent.get, reporting new progress, blockers, and the final outcome rather than unchanged status. Send here again to answer a question or add context to the same session. |
| `qawolf auth login` | local | Authenticate with QA Wolf in a browser or with an API key |
| `qawolf auth logout` | local | Remove stored credentials |
| `qawolf auth switch` | local | Choose which workspace to work in |
| `qawolf auth whoami` | read | Show authentication status |
| `qawolf automate` | write | Request automation for draft flows. First create a named local .flow.ts draft for every requested journey that does not already have a matching draft; never reuse a generic starter or placeholder. Each new draft must start with a JSDoc Goal: description, import flow from @qawolf/flows/web, and use export default flow(...); a comment-only file or direct test(...) call is not a valid draft. Commit and push all changes with Git to publish them, then list remote drafts to resolve every selected ID. Do not use patch to create or rename a selected flow. Finally make one automation request containing all requested flow IDs. |
| `qawolf doctor` | local | Diagnose problems running flows locally |
| `qawolf email find` | read | List the workspace's inbox, or its sent mail, newest first. Read a message body with email.get. |
| `qawolf email get` | read | Read one email of the workspace, with its plain text and HTML bodies. Use it to pull a sign-in code or a verification link out of a message. |
| `qawolf email getAttachment` | read | Read one attachment of a workspace email as base64 content, by file name or by position. email.get lists both. |
| `qawolf email listAddresses` | read | List the workspace's inbox addresses, alphabetical. A flow can sign up with a plus-suffixed form of any of them, and email.find reads what arrives. |
| `qawolf email registerAddress` | write | Register an inbox address for the workspace. Registering an address the workspace already has changes nothing. A refusal names the domains the workspace can use. |
| `qawolf email send` | write | Send an email from one of the workspace's inbox addresses, for example to exercise a flow that reacts to incoming mail. Returns the sent email; read it back with email.get. |
| `qawolf environment create` | write | Create an environment on the caller's team and return it in the environment.get shape. |
| `qawolf environment deleteVariable` | write | Remove one environment variable by name. Succeeds whether or not the variable existed. |
| `qawolf environment find` | read | List the team's environments, newest first. |
| `qawolf environment get` | read | Read a single environment's name, kind, standing run health, flow-code branch and reconciliation state, run concurrency limit, and termination state. If flowCodeBranch exists, use its syncStatus for Git reconciliation and read lastSyncedCommitHash only when syncStatus is reconciled. |
| `qawolf environment getVariable` | read | Read the values of named environment variables in one call. Values are secrets. Names that do not exist go to missingNames and do not fail the call. |
| `qawolf environment listVariableNames` | read | Use this to answer which QA Wolf environment variables are available to test code. Returns names only; values never leave the server. |
| `qawolf environment setVariable` | write | Create or replace an environment variable. If the user asks to create one for "my email" without naming it, use DEFAULT_EMAIL. The value is never returned. |
| `qawolf environment update` | write | Update an environment owned by the caller's team and return it in the environment.get shape. Omitted fields remain unchanged. |
| `qawolf flow addTag` | write | Assign an existing tag to the selected flows. Create tags with tag.create. Flows that already carry the tag are reported in skippedFlows. |
| `qawolf flow removeTag` | write | Remove a tag from the selected flows. Succeeds whether or not each flow carried the tag; the flows that did not are reported in skippedFlows. |
| `qawolf flow update` | write | Move a flow between draft and active readiness. The other statuses shown in the app are derived and cannot be set. |
| `qawolf flows list` | local (read with --remote) | List flows matching [pattern] from the local project, or from a QA Wolf environment with --remote |
| `qawolf flows pull` | read | Download an environment's flows into the local .qawolf/<env>/ cache |
| `qawolf flows run` | local (read with --env) | Run flows matching [pattern], or every flow when omitted; with --env, pull missing flows from that QA Wolf environment |
| `qawolf init` | local | Scaffold a QA Wolf project in the current directory |
| `qawolf install` | local | Install every runtime dependency the project's flows need |
| `qawolf install android` | local | Install Android system images, AVDs, and the Appium driver used by the project's Android flows |
| `qawolf install browsers` | local | Install Playwright browsers used by the project's web flows |
| `qawolf install clear` | local | Remove the managed runtime cache (all installed runtime versions) |
| `qawolf issue addFlows` | write | Add flows to a coverage request owned by the caller's team. Flows already covered stay covered. Bug and maintenance reports link to flows through the runs that reproduce them; use run.diagnose to record one. |
| `qawolf issue create` | write | Create a bug or coverage request issue for the caller's team. Maintenance issues cannot be created through the public API. |
| `qawolf issue find` | read | List the team's bug reports, maintenance reports, or coverage requests, newest first. |
| `qawolf issue get` | read | Get an issue by id. |
| `qawolf issue removeFlows` | write | Remove flows from a coverage request owned by the caller's team. Flows the request does not cover are left alone. Bug and maintenance reports link to flows through the runs that reproduce them, so their flows cannot be set directly. |
| `qawolf issue update` | write | Update an issue owned by the caller's team. Omitted fields remain unchanged. |
| `qawolf run create` | write | Create a run for the selected flows and/or tags in an environment. |
| `qawolf run diagnose` | write | Diagnose failed flows in a run as reproductions of a bug or maintenance report owned by the caller's team. The issue's type selects the diagnosis. Each flow must have failed in the run. A flow that is already diagnosed moves to this issue. The diagnosis appears on the run, and the reproduction appears under the issue's reproductions. Coverage requests cannot be diagnosed; use issue.addFlows to cover flows instead. |
| `qawolf run find` | read | List an environment's recent runs, newest first. |
| `qawolf run get` | read | Get a run's status, per-flow results, and links. |
| `qawolf run reattempt` | write | Request new attempts for a run's flows, in the same run. A flow is eligible once its result is failed or canceled and QA Wolf's automatic retries have finished. A fully investigated run no longer accepts reattempts. Attempts run with the latest flow code. Poll run.get for results. |
| `qawolf run stop` | write | Stop a run, including its queued flows and automatic retries. Stopping is asynchronous. Repeated requests are safe, and finished runs keep their results. A run that is still being created returns not found; retry once run.get returns the run. If run.get returns a different runId, use that ID. Poll run.get for results. |
| `qawolf runner act` | write | Perform one raw action on a runner's screen: click, double_click, scroll, move, drag, keypress, navigate or type. Use - to read a whole action as JSON from stdin. On a mobile runner only click (button left), drag and type have a touchscreen equivalent; the rest answer action-not-supported-on-mobile |
| `qawolf runner events` | read | Print a runner's journal, one entry per line. QA Wolf writes console, recorder, run-events, run-logs, run-status |
| `qawolf runner exec` | write | Evaluate a snippet against a runner's live page. Use - to read the snippet from stdin |
| `qawolf runner highlight-selector` | write | Highlight what a selector matches on a runner's live page, so the next screenshot shows it. Omit the selector to clear the highlight |
| `qawolf runner import-package` | write | Install a package into a runner's live run, so a snippet or a selection can import it |
| `qawolf runner inspect contexts` | read | List the WebView contexts available, and which is current |
| `qawolf runner inspect element-html` | read | Print the HTML of the first element a selector matches |
| `qawolf runner inspect elements` | read | Find elements at a screen point, or elements carrying some text |
| `qawolf runner inspect page-html` | read | Print the page's HTML, simplified for a model to read |
| `qawolf runner inspect page-source` | read | Print the current context's page source, as a tree |
| `qawolf runner inspect session` | read | Print the Appium session's status: ready, or why not |
| `qawolf runner inspect variable` | read | Print a top-level variable's value from the running workflow |
| `qawolf runner keepalive` | read | Reset a runner's inactivity clock, for a caller that pauses between actions |
| `qawolf runner launch` | write | Launch an interactive runner and make it this directory's default |
| `qawolf runner list` | read | List the runners running on your team |
| `qawolf runner promote-snapshot` | write | Accept a run's screenshot as the new baseline for an image diff, on the runner that produced it |
| `qawolf runner run` | write | Run a flow on an interactive runner, shipping the flow and what it imports |
| `qawolf runner screenshot` | read | Save a JPEG of an interactive runner's screen to a file, or write it to stdout with --out - |
| `qawolf runner stop-run` | write | Stop what a runner is currently executing, leaving the runner up |
| `qawolf runner terminate` | write | End an interactive runner, and the pod it runs on with it |
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
your actions into Playwright locators), `keepalive` to hold it open, and
`terminate`
when done. Everything is a plain request to one host, so a shell with an API key
and its own vision model can close the see-and-act loop with no other tooling.

The full workflow is its own guide: how a runner is billed, why the first call
must be a run, the order the commands go in, the see-and-act loop, `exec`, the
recorder, reading history, staying alive, and an end-to-end example. **Read
[`references/runner.md`](references/runner.md) before driving a runner for the
first time.** If that path is not on your filesystem, fetch it:
`https://raw.githubusercontent.com/qawolf/cli/main/skills/qawolf-cli/references/runner.md`.
