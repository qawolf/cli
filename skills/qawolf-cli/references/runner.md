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
with three catches worth knowing before you rely on it.

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

And launching an id that differs from `QAWOLF_RUNNER_ID` prints a warning on
stderr naming both ids: the variable still outranks the directory default, so
commands that omit `--runner` keep going to whatever it names, not the runner
you just launched. Expected when you are launching an additional runner on
purpose — address that one with `--runner` rather than re-exporting the
variable, which would repoint every other runner-less command too.

If nothing names a runner, the commands that change something will launch one
and say so on stderr, naming it: `run`, `act` and `exec`. **Read that
announcement.** The browser it just started is fresh: nothing has been run on it,
nothing is signed in, and no page is open. Acting as though your earlier setup
survived is the single most likely way to drive the wrong page.

No `read` command ever launches a runner. `screenshot`, `events` and `keepalive`
tell you there is no runner rather than quietly billing one, and so does
`terminate`, since starting a pod in order to end it would be absurd.

`--name` also chooses between a browser and a mobile device:
`qawolf runner launch --name android` or `--name ios` starts an Appium session
instead of a browser. A command built for the other kind answers a
`failureReason` naming the mismatch rather than doing something approximate —
`runner-is-not-mobile` from `inspect session`/`contexts`/`page-source`/`elements`
on a browser runner, `runner-is-not-a-browser` from `inspect element-html`/
`page-html` on a mobile one — so launch the right family up front rather than
discovering it from a refusal mid-session.

## Knowing what you are holding

`qawolf runner list` names the runners this directory has launched that are
still running, and marks the one a command with no `--runner` would reach:

```text
id                   family      default
tester-abc-main      playwright  yes
tester-abc-checkout  playwright
```

Every runner is looked up before it is listed, so a runner that idled out is
absent rather than reported. The lookup neither starts a runner nor resets an
inactivity clock, which is what separates `list` from `keepalive`: listing tells
you what is there and changes nothing, and holding a runner open is still
`keepalive`'s job. A lookup that cannot be answered fails the command rather
than returning a shorter list, because a short list reads as the whole truth.

Nothing is billed by listing, but everything in the list is billing. Terminate
what you are done with.

The list includes the runner named by `QAWOLF_RUNNER_ID` even though this
directory did not launch it, so a harness handed a runner sees it alongside the
ones it started itself. Use the `id` column with `--runner` to address any of
them; addressing one does not make it the default.

## The order that matters

A freshly launched runner has no screen. The virtual desktop starts with the
runner's **first run** and nothing else starts it, so until you have run
something:

- `screenshot` and `act` fail with exit code `2`, except `navigate`, which
  fails with exit code `1` (`action-failed`): it skips the screen but still
  needs the runner to have run something
- `exec` fails with exit code `2`
- `events recorder` reads as empty

None of that is a fault, and none of it clears on its own. **Only
`qawolf runner run <flow>` starts the screen.** A bare navigate does not: it
fails until the first run, however long you wait.

So the first thing you do to a new runner has to put a browser on it. That means
a flow file and a `package.json` on disk, even if all you want is to drive the
browser by hand; there is no "just give me a screen" call. Once one run has
happened, the screenshot-and-act loop below works for the rest of the runner's
life.

A `--lines` selection is the one call that does not need a run first. Sent to a
runner with no browser, the runner starts one and runs your lines against it,
and says so on stderr. Everything else on this page waits for a run.

Retry on the exit code, not on the message text:

- `4` is usually transient. The screen is up but cannot serve this instant:
  restarting after a display-size change, or busy with another request. Retry in
  a second or two — but bound the retries, because `4` also covers a runner that
  was reaped after inactivity, which no amount of retrying brings back. If `4`
  persists past a few tries, relaunch the id.
- `2` will not clear on its own. Either nothing has run on this runner yet, so
  run a flow, or the runner has no browser at all, so launch with
  `--name playwright` instead. The message says which.

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

A mobile runner has a touchscreen, not a mouse, so only three of the eight
actions have a touchscreen equivalent and go through: `click` with
`button: "left"` taps, `drag` swipes, and `type` types into whatever the last
tap focused. The rest — `double_click`, `scroll`, `move`, `keypress`,
`navigate` — answer `action-not-supported-on-mobile` rather than doing
something approximate. `navigate` is the one to watch for, since it works on a
browser runner without a run first but has no meaning on mobile at all.

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

## Reading the page: `inspect`

`qawolf runner inspect` answers one question about the live page and prints the
answer on stdout by itself, so you can redirect or pipe it:

```sh
qawolf runner inspect element-html --selector "#email"
qawolf runner inspect page-html > page.html
qawolf runner inspect page-html --selector "#cart"      # just that subtree
qawolf runner inspect variable --name cart | jq .total
```

`page-html` is simplified for a model to read rather than being the browser's
exact markup. `variable` reads a top-level variable of the running workflow and
prints it as JSON, which is how you see what your own code computed rather than
what the page shows.

One failure covers three causes, because a runner cannot tell them apart: no
live page, no element matching the selector, no variable under that name. All
three exit `2` and none clears by waiting, so read the message, which carries
whatever the runner said. An unreachable runner exits `4` and is worth retrying.

Use `inspect` before reaching for `exec`. Reading a value through a snippet
means printing it and then fishing it back out of the `console` stream, which is
two calls and a marker; `inspect variable` is one call and the value.

## Reading a mobile screen: `inspect session`/`contexts`/`page-source`/`elements`

`element-html`, `page-html` and `variable` are a browser's shapes. A mobile
runner answers four different ones instead, one subcommand per question:

```sh
qawolf runner inspect session
qawolf runner inspect contexts
qawolf runner inspect page-source
qawolf runner inspect page-source --context WEBVIEW_1     # a specific context, not the current one
qawolf runner inspect elements --by point --x 240 --y 480
qawolf runner inspect elements --by text --text "Sign in" --partial
```

`session` prints one summary line — ready, or why not — because that line is
the whole answer. `contexts`, `page-source` and `elements` instead print their
answer as JSON on stdout, on its own like `inspect element-html`, so you can
redirect or pipe it (`| jq .current`, `| jq .matches`, `| jq .pageSource`)
rather than getting a count with no way to see what was actually found.

`session` is also the one subcommand that never answers `screen-needs-a-run`:
readiness is the question it exists to answer, so it reports one of `ready`
(with the platform, device and session id), `unreachable`, `ambiguous` (more
than one session is somehow live) or `no-session`, rather than refusing until a
run has happened. The other three need a live session first and share the same
readiness contract `act` and `screenshot` use on a browser runner:
`screen-needs-a-run` exits `2` and means no Appium session has started on this
runner yet — run a flow that opens one, then inspect again; `screen-not-ready`
exits `4` and means the session exists but did not answer this instant, or more
than one is somehow live — retry once, and relaunch the runner if it persists.

`elements` takes one of two ways to search, chosen with `--by`: `point` needs
whole-pixel `--x`/`--y` on the device's own screen, the same coordinates a
screenshot is measured in; `text` needs `--text` and matches it exactly unless
`--partial` is passed. The two do not mix — `--by point` with `--text` set, or
`--by text` with `--x`/`--y` set, is refused before a runner is addressed
rather than silently searching by the one it picked, since the schema itself
just strips whichever field the chosen `by` does not define. `--context` on
`page-source` or `elements` reads a context other than the current one —
useful once `contexts` has told you which are available.

A browser runner answers `runner-is-not-mobile` to all four, exit `2`, since
retrying never helps: launch with `--name android` or `--name ios` instead.
`runner-unreachable` exits `4` and is worth retrying, same as everywhere else
on this surface.

## Checking a selector: `highlight-selector`

`inspect element-html` tells you what a selector matched. `highlight-selector`
shows you _where_ it is, by drawing on the page itself:

```sh
qawolf runner highlight-selector "text=Sign in"
qawolf runner screenshot                          # the highlight is in this
qawolf runner highlight-selector                  # omit the selector to clear
```

The highlight stays until it is replaced or cleared, which is the point: you
cannot see the runner's screen, so the only way to read the result is the next
screenshot.

Three answers are worth telling apart. A selector that matched prints how many
elements it hit and exits `0`. A selector the page read fine but that matched
nothing also exits `0`, because the call did what was asked and the count is the
answer; the message says the syntax was fine so you look at the page, not the
locator. A selector the page could not read at all exits `2`, because that one
is yours to correct and retrying will not change it.

`runner-cannot-highlight-selectors` exits `2` and means the runner has no
browser to draw on. `no-answer` exits `4`: a highlight runs inside the page, so
a page that is gone or mid-navigation does not answer at all rather than
answering slowly.

## Accepting a new baseline: `promote-snapshot`

When a run's image diff fails and the new screenshot is the one you want, this
replaces the baseline on the runner that produced it:

```sh
qawolf runner events run-events --tail 20 | jq 'select(.type == "image-diff-artifact")'
qawolf runner promote-snapshot --screenshot checkout-1-actual.png --baseline checkout-1.png
```

Both paths are the ones the diff reported, and both are named rather than
positional, because two paths with one unlabelled is easy to get backwards and
swapping them promotes the wrong image. They are paths inside the run's own
screenshot storage, not files on your machine.

`snapshot-not-found` exits `2` and means the run wrote no screenshot at that
path, which nearly always means the paths did not come from a diff this run
produced. Nothing is changed, so correcting the path and repeating is safe.
Promoting twice is also safe, so an unreachable runner is worth retrying.

## Installing a package mid-session

`qawolf runner import-package <name>` installs a package into the runner's live
run, so a snippet or a selection can import it without a whole run to reinstall
dependencies:

```sh
qawolf runner import-package dayjs
qawolf runner import-package dayjs --package-version 1.11.13
```

The version defaults to `latest`, and the flag is `--package-version` because
`--version` belongs to the CLI itself. The install resolves against your
project's own dependencies, read from `package.json`, so it needs a run already
going: there is no live run on a runner that has not run anything. npm's own
refusal comes back verbatim on an exit `2`, which is a name or a version to
correct rather than something to retry.

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

`qawolf runner run <flowFile>` ships the flow file, everything it imports, and
your `package.json` and `tsconfig.json`. Nothing else travels, so you can run
from the root of a large project without sending it. The runner holds no copy of
your project, so what runs is exactly what is on disk at that moment,
uncommitted edits included.

Imports are followed the same way a run from the QA Wolf app follows them:
relative paths and `tsconfig.json` path aliases, resolving `.ts` and `.js`. An
`export ... from` re-export is not followed, and neither is `require()`, so a
barrel file does not pull in what it re-exports. A `package.json` has to be
there, since the run reads its npm dependencies from it, and the files may carry
at most 30 MiB in total. A missing file, a missing `package.json` and files over
the cap are all refused before any runner is resolved or launched, so a typo
costs nothing.

After the first run on a runner, later runs send only the files whose content
changed, so iterating on one flow costs a small request rather than the whole
graph again. `--json` reports which happened as `fileSync`, `delta` or `full`.
Nothing about this needs managing: the baseline lives in `.qawolf/runner-files.json`,
a switch to another runner ignores it, and a runner that turns out not to hold
what was claimed gets the whole set resent automatically.

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

There are two ways, and a run takes one of them. `--env-id` names a QA Wolf
environment by id or alias, the same reference `qawolf flows` takes as `--env`.
`--env-file .env` gives the run the variables in a dotenv file, in the format
`qawolf flows pull` writes.

```sh
qawolf runner run flows/checkout.flow.ts --env-id staging
qawolf runner run flows/checkout.flow.ts --env-file .env
```

**A run with neither flag falls back to `QAWOLF_ENVIRONMENT`**, the same
variable `qawolf flows` reads, so one export covers both. The run says on
stderr which environment it picked up, because those variables reach your flow's
code and a run should never be given an environment silently. `--env-id` wins
over it, and `--env-file` suppresses it, so a run reading a dotenv file is not
handed a second environment on top.

```sh
export QAWOLF_ENVIRONMENT=staging
qawolf runner run flows/checkout.flow.ts     # runs against staging
```

**Prefer `--env-id`.** QA Wolf reads and decrypts the environment itself, so the
values never leave the server, nothing has to be pulled to disk first, and no
size limit applies to them. It is the only way to run a flow whose environment
holds something large, such as a session cookie.

A run that sends its own variables with `--env-file` may carry at most 200 of
them, each value at most 16 KiB. Names follow what a shell accepts, and
`QAWOLF_TEAM_ID` is reserved because QA Wolf sets it from the key you
authenticated with. All of that is refused before a runner is addressed, naming
the variable at fault.

Passing both flags is refused. They each give the run its whole environment, so
there is no order in which they would combine.

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

## Stopping a run vs ending a runner

Two different things, and the names are the only warning you get:

- `qawolf runner stop-run` stops what the runner is executing and leaves the
  runner up, its browser on whatever page the run reached. The run settles as
  stopped rather than passed or failed. Use it to abandon a run and keep the
  browser you were working against.
- `qawolf runner terminate` ends the runner and the pod with it. Everything on
  it is gone, and the next command under that id launches and bills a new one.

Both succeed when there was nothing to do, and say which: `wasRunning` is
`false` when no run was going, and when no runner was running. Neither is an
error, so a retry needs no special handling.

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

qawolf runner inspect element-html --selector "#email"
qawolf runner inspect variable --name cart | jq .total

qawolf runner run flows/smoke.flow.ts --lines 12-40 --follow   # just those lines
qawolf runner events recorder --tail 5 | jq -r '[.locator] + (.alternates // []) | @tsv'
qawolf runner terminate
```
