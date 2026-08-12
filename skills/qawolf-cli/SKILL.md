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
- `6` `run --follow` stopped waiting before the run settled; the run may still
  be going

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
robust for a harness whose working directory may not be stable, but it comes
with two catches worth knowing before you rely on it.

`qawolf runner launch` is not in that order: it takes its id from `--id` and
never reads `QAWOLF_RUNNER_ID`. Bare `qawolf runner launch` invents a random id,
bills a pod under it and stores it, so a harness that exported the variable and
then launched without `--id` ends up with a pod it is not addressing. Pass
`--id` whenever you have an id in mind.

And a runner id that is set is treated as found, whether or not anything is
running under it. So exporting `QAWOLF_RUNNER_ID=agent-1` turns off the
auto-launch described next: instead of starting `agent-1`, commands try to reach
it and fail with exit code `4`, which reads as "retry" and never succeeds.
Launch that id once yourself and the rest follows.

If nothing names a runner, the commands that change something will launch one
and say so on stderr, naming it: `run`, `act` and `exec`. **Read that
announcement.** The browser it just started is fresh: nothing has been run on it,
nothing is signed in, and no page is open. Acting as though your earlier setup
survived is the single most likely way to drive the wrong page.

No `read` command ever launches a runner. `screenshot`, `events` and `keepalive`
tell you there is no runner rather than quietly billing one, and so does `stop`,
since starting a pod in order to stop it would be absurd.

### The order that matters

A freshly launched runner has no screen. The virtual desktop starts with the
runner's **first run** and nothing else starts it, so until you have run
something:

- `screenshot` and `act` fail with exit code `2`, except `navigate`, which
  fails with exit code `1` (`action-failed`): it skips the screen but still
  needs the runner to have run something
- `exec` fails with exit code `4`
- `events recorder` reads as empty

None of that is a fault, and none of it clears on its own. **Only
`qawolf runner run <flow>` starts the screen.** A bare navigate does not: it
fails until the first run, however long you wait.

So the first call on a new runner has to be a run. That means a flow file and a
`package.json` on disk, even if all you want is to drive the browser by hand;
there is no "just give me a screen" call. Once one run has happened, the
screenshot-and-act loop below works for the rest of the runner's life.

Retry on the exit code, not on the message text:

- `4` is usually transient. The screen is up but cannot serve this instant:
  restarting after a display-size change, or busy with another request. Retry in
  a second or two — but bound the retries, because `4` also covers a runner that
  was reaped after inactivity, which no amount of retrying brings back. If `4`
  persists past a few tries, relaunch the id.
- `2` will not clear on its own. Either nothing has run on this runner yet, so
  run a flow, or the runner has no browser at all, so launch with
  `--name node20WithPlaywright` instead. The message says which.

The one exception is `exec`, which reports both as `4`; read its message to tell
them apart.

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

`act`, `run` and `exec` are the three commands whose lost answer may still have
taken effect. On a `4` from `act`, take a screenshot before repeating a click.
`exec`'s message says the snippet could not be evaluated, but a lost answer
looks the same from outside, so treat a `4` from a snippet that changes something
as "may have run" rather than "did not run".

### The recorder: what you cannot get from pixels

`qawolf runner events recorder` is the capability that has no equivalent in a
screenshot. As you drive the browser, the runner records each interaction and
publishes `locator` (the real Playwright locator it resolved), `alternates` (the
others that matched the same element) and `code` (the generated Playwright call),
alongside `type`, `sourceUrl` and `timestamp`.

```sh
qawolf runner events recorder --tail 5 | jq -r '.code // .type'          # what happened
qawolf runner events recorder --tail 5 | jq -r '[.locator] + (.alternates // []) | @tsv'
```

`code` is absent on events with no call of their own, such as a navigation, which
is why the first line falls back to `type`. Use these to turn a session you drove
by pixel coordinates into durable selectors, and to check that a click landed on
the element you meant rather than near it. The stream is empty until the session
has a browser context, so an early empty answer means "not yet", not "broken".
Do not add `--json` here: it wraps each line in an envelope and these field paths
stop matching.

### Reading the page: `exec`

`qawolf runner exec <file>` evaluates a snippet against whatever the runner's
browser is showing, which is how you read a value out of the page rather than
looking at it. Two things to know, because neither is guessable:

It does not return what the snippet evaluated to, only whether it ran. To get a
value back, print it and read the `console` stream:

```sh
echo 'console.log(await page.title())' | qawolf runner exec -
qawolf runner events console --tail 1 | jq -r '.message'
```

And the snippet imports nothing of yours by default. Pass `--file <path>` to
evaluate it in that file's scope, which also ships the directory's other files,
so the snippet can use your own page objects and helpers.

### Running a flow

`qawolf runner run <file>` ships the current directory's runnable files with the
request. The runner holds no copy of your project, so what runs is exactly what
is on disk at that moment, uncommitted edits included. A `package.json` has to
be there, since the run reads its npm dependencies from it, and the files may
carry at most 4 MiB in total: run from a directory holding the flow and what it
imports rather than from the root of a large monorepo. A missing file, a missing
`package.json` and files over the cap are all refused before any runner is
resolved or launched, so a typo costs nothing.

The call answers with a run id as soon as the run is accepted. **The outcome is
not in that answer**, it is in the `run-status` stream, whose entries carry
`runId`, `status` and an `errorMessage` when there is one.

**Pass `--follow` to `run` and let it wait for you.** It streams the run's logs
and ends on the settled status, never on the logs, so a run that prints nothing
still terminates the follow and a run that dies mid-sentence still reports how.
Exit code `1` means the run did not pass.

```sh
qawolf runner run flows/checkout.flow.ts --follow
```

If you would rather submit and come back later, note that `--follow` on `events`
is `tail -f` and never returns on its own, so it cannot be used to wait for a
run. Poll instead, and decide with the same rule the CLI uses: `status` is
`in-progress` while the run is going, and any other value means it has settled.

```sh
qawolf runner run flows/checkout.flow.ts --json     # -> {"runId":"...","runnerId":"..."}
qawolf runner events run-status --run <runId> --tail 1 | jq -r '.status'
```

The one expensive mistake on this surface: **if `run` reports that the runner
could not be reached, that does not mean the run did not start.** The runner may
have accepted it and been too slow to answer, and resubmitting bills and journals
a second run.

There is no clean recovery here, so it is worth being plain about it. The journal
lives on the same pod, so while the runner stays unreachable a `run-status` read
fails the same way and cannot tell you whether a run is going. Wait for the
runner to answer again, then read `run-status` without `--run` and look at the
newest `runId`: if one appeared, that is your run and you should follow it rather
than submit again. Only resubmit once a read has succeeded and shown you nothing.

### Reading history

Everything observable is an append-only stream on the pod, read by cursor or
tail rather than subscribed to, so attaching late still gets you the history that
is still there. It is not unbounded: a size cap drops the oldest entries on a
long-lived runner, and a `--tail N` read can stop early and hand back fewer than
N even when more matched. Both are warned about on stderr — dropped entries only
once a read holds a cursor, a stopped-early read with a pointer at `--since` —
so watch stderr, treat a short answer as "at least this" rather than "all there
was", and read what you care about as you go rather than at the end. QA Wolf writes `recorder`, `console`, `run-events`,
`run-logs` and `run-status`; a stream nobody has written reads as empty rather
than as an error, and a stream this CLI version does not know about is still
readable by name.

One payload per line, so shell tools compose:

```sh
qawolf runner events console --tail 20 | jq -r '.message'
qawolf runner events run-logs --run <runId> --follow > run.log
```

`--tail N` takes the newest N, `--since <sequence>` reads everything after a
cursor, and `--run <id>` narrows the run-scoped streams.

`--follow` polls and prints as entries arrive. It is `tail -f`: it never returns
on its own, so redirect it to a file and stop it yourself, or use repeated
`--since` reads when you need the command to end.

Where it does win is the cursor. The pod reports how far a read scanned rather
than how far it matched, and `--follow` carries that number, so a filtered read
that matched nothing still moves forward. A caller paging by hand cannot see it,
because the CLI does not print it, and the best available substitute is the
highest `sequence` you actually saw. So a narrow `--run` filter over a busy
stream stalls: with nothing matching, there is no new `sequence` to move on to,
and you re-read the same window until something matches (NOVA-1397).

### Staying alive

A runner is reaped after a period of inactivity, and every command that talks to
the runner counts as activity, including a journal read.
`qawolf runner keepalive` exists for the gap that creates: a harness that thinks,
or waits on a human, for minutes between actions would otherwise come back to a
pod that is gone. It resets the clock and tells you the runner is still there.

It is listed as a `read`, but it is the one read with a cost: keeping the clock
reset keeps a billed pod alive. Call it while you are genuinely still working, not
on a timer you forget, and call `qawolf runner stop` when you are done rather
than leaving a pod to time out. A loop that keeps a runner alive and never stops
it bills until someone notices.

### End to end

Run from a directory holding a flow and a `package.json`. The run is what starts
the screen, so it is not optional even though the goal here is to drive by hand.

```sh
export QAWOLF_API_KEY=...          # the only credential
export QAWOLF_RUNNER_ID=agent-1    # so no command below needs --runner

qawolf runner launch --id agent-1 --json          # --id, not the variable; read .outcome
qawolf runner run flows/smoke.flow.ts --follow    # starts the screen; exit 1 if it failed

qawolf runner act navigate --url https://example.com/login
qawolf runner screenshot --out page.jpg           # then read page.jpg yourself
qawolf runner act click --button left --x 480 --y 260
qawolf runner act type --text "someone@example.com"

qawolf runner events recorder --tail 5 | jq -r '[.locator] + (.alternates // []) | @tsv'
qawolf runner stop
```
