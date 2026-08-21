# Driving a runner from the terminal

An interactive runner is a live pod with a browser in it. You launch one, look
at it, act on it, run flows on it, and read what it recorded. Everything is a
plain request to one host, so there is no connection to hold open.

## Getting one

Runner ids are yours to choose and are scoped to your team, so `agent-1` is a
fine id. Launching an id that is already running attaches to that runner instead
of starting and billing a second one, and the answer says which happened: read
`alreadyRunning`. Reusing one id is therefore the
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
tell you there is no runner rather than quietly billing one, and so does
`terminate`, since starting a pod in order to end it would be absurd.

## The order that matters

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
  `--name playwright` instead. The message says which.

The one exception is `exec`, which reports both as `4`; read its message to tell
them apart.

## Seeing and acting: the loop is yours

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

## The recorder: what you cannot get from pixels

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

## Reading the page: `exec`

`qawolf runner exec <file>` evaluates a snippet against whatever the runner's
browser is showing, which is how you read a value out of the page rather than
looking at it. Two things to know, because neither is guessable:

It does not return what the snippet evaluated to, only whether it ran. To get a
value back, print it and read the `console` stream. Print it behind a marker you
chose, and match on that rather than taking the newest line: the page logs to the
same stream, so anything it prints after your snippet would be what `--tail 1`
hands back. Entries carry `source`, which is `serverConsole` for your snippet and
`browserConsole` for the page, so filtering on both is what pins the value down.

```sh
echo 'console.log("qw-title:", await page.title())' | qawolf runner exec -
qawolf runner events console --tail 20 \
  | jq -r 'select(.source == "serverConsole" and (.message | contains("qw-title:"))) | .message'
```

And the snippet imports nothing of yours by default. Pass `--file <path>` to
evaluate it in that file's scope, which also ships the directory's other files,
so the snippet can use your own page objects and helpers.

## Running a flow

`qawolf runner run <flowFile>` ships the current directory's runnable files with the
request. The runner holds no copy of your project, so what runs is exactly what
is on disk at that moment, uncommitted edits included. A `package.json` has to
be there, since the run reads its npm dependencies from it, and the files may
carry at most 30 MiB in total: run from a directory holding the flow and what it
imports rather than from the root of a large monorepo. A missing file, a missing
`package.json` and files over the cap are all refused before any runner is
resolved or launched, so a typo costs nothing.

The call answers with a run id as soon as the run is accepted. **The outcome is
not in that answer**, it is in the `run-status` stream, whose entries carry
`runId`, `status` and an `errorMessage` when there is one.

### Running part of a flow

`--lines 12-40` runs those lines against the browser as it stands, so nothing is
re-navigated and nothing is signed in again. Use it to iterate on a step without
paying for the whole flow to reach it again.

The two file paths are the thing to get right, because getting them backwards
runs the wrong code and nothing reports it:

- the positional is **always the flow file**. It is the run's entry point, and it
  is required for every run, selection or not.
- `--lines-file` is **where the lines live**. It defaults to the positional, so
  pass it only when the range is in another file, typically a page object whose
  method you want to run against the instance your last run left alive.

```sh
qawolf runner run flows/checkout.flow.ts --lines 12-40          # lines in the flow file
qawolf runner run flows/checkout.flow.ts --lines 4-9 \
  --lines-file pages/login.ts                                   # lines in a page object
```

The lines-file has to be one of the files that travel, so it lives under the
directory you run from. A range whose file is not collected is refused before a
runner is addressed, naming the path.

### Giving the run environment variables

`--env-file .env` gives the run the variables in a dotenv file, in the format
`qawolf flows pull` writes. It is `--env-file` and not `--env`, which on
`qawolf flows` means a QA Wolf environment by id or slug.

A run may carry at most 100 variables, each value at most 8 KiB. Names follow
what a shell accepts, and `QAWOLF_TEAM_ID` is reserved because QA Wolf sets it
from the key you authenticated with. All of that is refused before a runner is
addressed, naming the variable at fault.

If the runner had no browser, one is started before your lines run, and the
command says so on stderr. Those lines then ran against a fresh page rather than
the one an earlier run left, which is worth reading before you act on what you
see.

**Pass `--follow` to `run` and let it wait for you.** It reports the run's
status — in progress, then passed or failed — and ends on the settled status.
Exit code `1` means the run did not pass. Three flags mirror more streams into
the follow, and each implies `--follow` on its own: `--logs` streams every log
line the run produces, `--run-events` streams the run's progress events as JSON
lines, and `--recorder-events` streams the browser actions the runner records
as JSON lines — the recorder is runner-wide rather than run-scoped, so that one
carries whatever is recorded after an anchor taken just before submission. Whatever mirrors are on, the
follow still ends on the status, never on them, so a run that prints nothing
still terminates the follow and a run that dies mid-sentence still reports how.
Combining mirror flags interleaves their lines with nothing saying which stream
a line came from — fine for eyeballs; when parsing, follow one stream at a time.

```sh
qawolf runner run flows/checkout.flow.ts --follow
qawolf runner run flows/checkout.flow.ts --follow --logs
qawolf runner run flows/checkout.flow.ts --follow --recorder-events
```

If you would rather submit and come back later, note that `--follow` on `events`
does not end when the run settles — it runs until its own `--timeout`, an hour
by default — so it cannot be used to wait for a run. Poll instead, and decide
with the same rule the CLI uses: `status` is `in-progress` while the run is
going, and any other value means it has settled.

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
newest `runId`. Nothing ties that id back to your submission: `run` never
answered, so you have no id to match it against, and a runner takes work from
anyone addressing it. Treat the newest id as your run only if you know nothing
else submits to this runner; otherwise follow it to see what it is before acting
on it. An empty read is not proof the run did not start, though:
`run` returns the moment the run is accepted, and its first `run-status` entry
may not be written yet, so a run accepted just before the runner went quiet can
still be in flight with nothing to show. `runFlow` has no idempotency key, so a
resubmit always risks a second billed run. Prefer polling `run-status` a while
longer over resubmitting; only submit again once you are willing to accept that
risk.

## Reading history

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

`--follow` polls and prints as entries arrive. It is `tail -f` with a bound: it
ends only at its `--timeout` (an hour by default, exit `6`), because reading
keeps the runner alive and billing. Redirect it to a file and stop it yourself,
or use repeated `--since` reads when you need the command to end sooner.

Where it does win is the cursor. The pod reports how far a read scanned rather
than how far it matched, and `--follow` carries that number, so a filtered read
that matched nothing still moves forward. A caller paging by hand cannot see it,
because the CLI does not print it, and the best available substitute is the
highest `sequence` you actually saw. So a narrow `--run` filter over a busy
stream stalls: with nothing matching, there is no new `sequence` to move on to,
and you re-read the same window until something matches (NOVA-1397).

## Staying alive

A runner is reaped after a period of inactivity, and every command that talks to
the runner counts as activity, including a journal read.
`qawolf runner keepalive` exists for the gap that creates: a harness that thinks,
or waits on a human, for minutes between actions would otherwise come back to a
pod that is gone. It resets the clock and tells you the runner is still there.

It is listed as a `read`, but it is the one read with a cost: keeping the clock
reset keeps a billed pod alive. Call it while you are genuinely still working, not
on a timer you forget, and call `qawolf runner terminate` when you are done rather
than leaving a pod to time out. A loop that keeps a runner alive and never stops
it bills until someone notices.

## End to end

Run from a directory holding a flow and a `package.json`. The run is what starts
the screen, so it is not optional even though the goal here is to drive by hand.

```sh
export QAWOLF_API_KEY=...          # the only credential
export QAWOLF_RUNNER_ID=agent-1    # so no command below needs --runner

qawolf runner launch --id agent-1 --json          # --id, not the variable; read .alreadyRunning
qawolf runner run flows/smoke.flow.ts --follow    # starts the screen; exit 1 if it failed

qawolf runner act navigate --url https://example.com/login
qawolf runner screenshot --out page.jpg           # then read page.jpg yourself
qawolf runner act click --button left --x 480 --y 260
qawolf runner act type --text "someone@example.com"

qawolf runner events recorder --tail 5 | jq -r '[.locator] + (.alternates // []) | @tsv'
qawolf runner terminate
```
