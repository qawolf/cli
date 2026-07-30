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

Exit codes are stable and worth branching on: `1` means the thing you asked for
was attempted and did not succeed (a run that failed, an action that did not
take effect); `2` means you asked for something impossible (bad arguments, or a
runner that can never do it); `4` means it could not be served right now and is
worth retrying. `qawolf runner --help` and `docs/exit-codes.md` carry the rest.

## Safety: reads vs writes

Read commands do not change team data, but some have operational effects noted
in their command entry. Write commands act on the real team. Do not invent
configuration or write speculative values; write only when requested or when
the task requires missing configuration whose exact value is known. A
successful write response is confirmation, so do not read immediately only to
verify it. Never blind-retry a write on timeout: it may have reached the server
the first time.

Two runner-specific costs to keep in mind. Launching a runner starts a billed
pod, so reuse one id rather than minting new ones per step. And `qawolf runner
run` is the one command where a lost answer is expensive; see below.

## Git-backed workflows

Inspect `git status` before publishing. Stage and commit only files changed for
the current task, preserve unrelated worktree changes, then push the task's
current branch.

## Commands

<!-- commands-table:start: generated by `bun run generate`, do not edit -->

| Command                                | Kind                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `qawolf auth login`                    | local                      | Authenticate with your QA Wolf API key                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `qawolf auth logout`                   | local                      | Remove stored credentials                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `qawolf auth whoami`                   | read                       | Show authentication status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `qawolf automate`                      | write                      | Request automation for draft flows. First create a named local .flow.ts draft for every requested journey that does not already have a matching draft; never reuse a generic starter or placeholder. Each new draft must start with a JSDoc Goal: description, import flow from @qawolf/flows/web, and use export default flow(...); a comment-only file or direct test(...) call is not a valid draft. Commit and push all changes with Git to publish them, then list remote drafts to resolve every selected ID. Do not use patch to create or rename a selected flow. Finally make one automation request containing all requested flow IDs. |
| `qawolf doctor`                        | local                      | Diagnose problems running flows locally                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `qawolf environment create`            | write                      | Create an environment on the caller's team and return it in the environment.get shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `qawolf environment deleteVariable`    | write                      | Remove one environment variable by name. Succeeds whether or not the variable existed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `qawolf environment find`              | read                       | List the team's environments, newest first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `qawolf environment get`               | read                       | Read a single environment's name, kind, health status, run concurrency limit, and termination state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `qawolf environment getVariable`       | read                       | Read the values of named environment variables in one call. Values are secrets. Names that do not exist go to missingNames and do not fail the call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `qawolf environment listVariableNames` | read                       | Use this to answer which QA Wolf environment variables are available to test code. Returns names only; values never leave the server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `qawolf environment setVariable`       | write                      | Create or replace an environment variable. If the user asks to create one for "my email" without naming it, use DEFAULT_ENVIRONMENT_EMAIL. The value is never returned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `qawolf environment update`            | write                      | Update an environment owned by the caller's team and return it in the environment.get shape. Omitted fields remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `qawolf flow addTag`                   | write                      | Assign an existing tag to the selected flows. Create tags with tag.create.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `qawolf flow update`                   | write                      | Move a flow between draft and active readiness. The other statuses shown in the app are derived and cannot be set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `qawolf flows list`                    | local (read with --remote) | List flows matching [pattern] from the local project, or from a QA Wolf environment with --remote                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `qawolf flows pull`                    | read                       | Download an environment's flows into the local .qawolf/<env>/ cache                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `qawolf flows run`                     | local (read with --env)    | Run flows matching [pattern], or every flow when omitted; with --env, pull missing flows from that QA Wolf environment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `qawolf init`                          | local                      | Scaffold a QA Wolf project in the current directory                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `qawolf install`                       | local                      | Install every runtime dependency the project's flows need                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `qawolf install android`               | local                      | Install Android system images, AVDs, and the Appium driver used by the project's Android flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `qawolf install browsers`              | local                      | Install Playwright browsers used by the project's web flows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `qawolf install clear`                 | local                      | Remove the managed runtime cache (all installed runtime versions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `qawolf issue create`                  | write                      | Create a bug or coverage request issue for the caller's team. Maintenance issues cannot be created through the public API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `qawolf issue find`                    | read                       | List the team's bug reports, maintenance reports, or coverage requests, newest first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `qawolf issue get`                     | read                       | Get an issue by id.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `qawolf run create`                    | write                      | Create a run for the selected flows and/or tags in an environment.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `qawolf run find`                      | read                       | List an environment's recent runs, newest first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `qawolf run get`                       | read                       | Get a run's status, per-flow results, and links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `qawolf runner act`                    | write                      | Perform one raw action on a runner's screen: click, double_click, scroll, move, drag, keypress, navigate or type. Use - to read a whole action as JSON from stdin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `qawolf runner events`                 | read                       | Print a runner's journal, one entry per line. QA Wolf writes console, recorder, run-events, run-logs, run-status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `qawolf runner exec`                   | write                      | Evaluate a snippet against a runner's live page. Use - to read the snippet from stdin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `qawolf runner keepalive`              | read                       | Reset a runner's inactivity clock, for a caller that pauses between actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `qawolf runner launch`                 | write                      | Launch an interactive runner and make it this directory's default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `qawolf runner run`                    | write                      | Run a flow on an interactive runner, shipping the current directory's files with it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `qawolf runner screenshot`             | read                       | Save a JPEG of an interactive runner's screen to a file                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `qawolf runner stop`                   | write                      | Stop an interactive runner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `qawolf tag create`                    | write                      | Create a tag on the caller's team. Tags select flows in run.create.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `qawolf tag list`                      | read                       | List the team's tags, alphabetical by name. Tag names select flows in run.create.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

<!-- commands-table:end -->

Kinds: `read` calls the QA Wolf API without changing anything; `write`
changes team state; `local` only affects this machine. A parenthesized
note like `local (read with --remote)` means that flag makes the command
call the QA Wolf API and require auth.

## Driving a browser: the `runner` group

An interactive runner is a live pod with a browser in it. You launch one, look
at it, act on it, run flows on it, and read what it recorded. Everything is a
plain request to one host, so there is no connection to hold open.

### Getting one

Runner ids are yours to choose and are scoped to your team, so `agent-1` is a
fine id. Launching an id that is already running attaches to that runner instead
of starting and billing a second one, and the answer says which happened: read
`outcome` for `launched` or `already-running`. Reusing one id is therefore the
cheap and safe pattern, and the same id with a different `--name` is refused
rather than silently ignored.

Commands that target a runner find one in this order: `--runner`, then
`QAWOLF_RUNNER_ID`, then the runner stored for the current directory (which
`qawolf runner launch` sets). Setting the environment variable once is the most
robust for a harness whose working directory may not be stable.

If none of those finds a runner, the commands that change something will launch
one and say so on stderr, naming it: `run`, `act` and `exec`. **Read that
announcement.** The browser it just started is fresh: nothing has been run on it,
nothing is signed in, and no page is open. Acting as though your earlier setup
survived is the single most likely way to drive the wrong page.

No `read` command ever launches a runner. `screenshot`, `events` and `keepalive`
tell you there is no runner rather than quietly billing one, and so does `stop`,
since starting a pod in order to stop it would be absurd.

### The order that matters

A freshly launched runner has no page and no screen yet. Its virtual desktop
starts with the runner's first run, so until something opens a page:

- `screenshot` and `act` (other than `navigate`) answer `screen-not-ready`
- `exec` reports that there is no live page to evaluate against
- `events recorder` reads as empty

None of that is a fault. Open a page first, with either
`qawolf runner act navigate --url <url>` (which goes through the page rather
than the screen, so it is the one action that works before the screen starts) or
`qawolf runner run <flow>`. Either will also launch a runner if you have none, so
that first call is all you need. After it, the loop below works.

Tell `screen-not-ready` and `runner-has-no-screen` apart before retrying. The
first is transient and clears in a second or two. The second means you launched
a runner with no browser at all, which no amount of retrying fixes: launch a
`node20WithPlaywright` runner instead.

### Seeing and acting: the loop is yours

Two primitives, and you close the loop with your own model. There is no hosted
vision loop on this surface.

`qawolf runner screenshot --out page.jpg` writes a real JPEG to disk, decoded,
because every coding harness can open an image file. Read it with whatever
vision you have.

`qawolf runner act <action>` performs exactly one action per call, in the
computer-use tool vocabulary a vision model already emits: `click`,
`double_click`, `scroll`, `move`, `drag`, `keypress`, `navigate`, `type`. The
names and the field names are unchanged from that vocabulary on purpose, so you
can forward a tool call rather than translate it:

```sh
echo '{"type":"click","button":"left","x":480,"y":260}' | qawolf runner act -
```

Coordinates are pixels on the same screenshot you just read. The runner serves
one see-or-act request at a time, so decide what to do next from each answer
rather than firing several. Bounds are checked before anything is sent, so an
over-long `--text` or an out-of-range coordinate comes back immediately naming
the limit instead of occupying the runner and then failing.

`act` and `run` are the two commands whose lost answer may still have taken
effect. On a `4` from `act`, take a screenshot before repeating a click.

### The recorder: what you cannot get from pixels

`qawolf runner events recorder` is the capability that has no equivalent in a
screenshot. As you drive the browser, the runner records each interaction and
publishes the real Playwright locator it resolved, the alternates that also
matched the element, and the generated Playwright call:

```sh
qawolf runner events recorder --tail 5 | jq -r '.code // .type'
```

Use it to turn a session you drove by pixel coordinates into durable selectors,
and to check that a click landed on the element you meant rather than near it.
The stream is empty until the session has a browser context, so an early empty
answer means "not yet", not "broken".

### Running a flow

`qawolf runner run <file>` ships the current directory's runnable files with the
request. The runner holds no copy of your project, so what runs is exactly what
is on disk at that moment, uncommitted edits included. A `package.json` has to
be there, since the run reads its npm dependencies from it, and the payload is
capped: run from a directory holding the flow and what it imports rather than
from the root of a large monorepo.

The call answers with a run id as soon as the run is accepted. **The outcome is
not in that answer**, it is in the `run-status` stream:

```sh
qawolf runner run flows/checkout.flow.ts --json     # -> {"runId":"...","runnerId":"..."}
qawolf runner events run-status --run <runId> --tail 1
```

`--follow` does both: it streams the run's logs and ends on the settled status,
never on the logs, so a run that prints nothing still terminates the follow and
a run that dies mid-sentence still reports how. Exit code `1` means the run did
not pass.

The one expensive mistake on this surface: **if `run` reports that the runner
could not be reached, that does not mean the run did not start.** The runner may
have accepted it and been too slow to answer. Resubmitting bills and journals a
second run. Read `qawolf runner events run-status` first and use the newest run
id there if one appeared.

### Reading history

Everything observable is an append-only stream on the pod, read by cursor or
tail rather than subscribed to, so nothing is missed by attaching late. QA Wolf
writes `recorder`, `console`, `run-events`, `run-logs` and `run-status`; a stream
nobody has written reads as empty rather than as an error, and a stream this CLI
version does not know about is still readable by name.

One payload per line, so shell tools compose:

```sh
qawolf runner events console --tail 20 | jq -r '.message'
qawolf runner events run-logs --run <runId> --follow > run.log
```

`--tail N` takes the newest N, `--since <sequence>` reads everything after a
cursor, and `--run <id>` narrows the run-scoped streams. To page forward by
hand, pass `--json` and use the highest `sequence` you saw as the next
`--since`. Prefer `--follow` where you can: it carries the cursor for you, and it
advances correctly on a filtered read that matched nothing, which hand-paging
cannot yet do (NOVA-1397).

### Staying alive

A runner is reaped after a period of inactivity, and every command that talks to
the runner counts as activity, including a journal read.
`qawolf runner keepalive` exists for the gap that creates: a harness that thinks,
or waits on a human, for minutes between actions would otherwise come back to a
pod that is gone. It is a cheap read that resets the clock and
tells you the runner is still there. Call it while you think, and
`qawolf runner stop` when you are done rather than leaving a pod to time out.

### End to end

```sh
export QAWOLF_API_KEY=...          # the only credential
export QAWOLF_RUNNER_ID=agent-1    # so no command below needs --runner

qawolf runner launch --id agent-1 --json          # read .outcome
qawolf runner act navigate --url https://example.com/login
qawolf runner screenshot --out page.jpg           # then read page.jpg yourself
qawolf runner act click --button left --x 480 --y 260
qawolf runner act type --text "someone@example.com"
qawolf runner events recorder --tail 5 | jq -r '.code // .type'
qawolf runner stop
```
