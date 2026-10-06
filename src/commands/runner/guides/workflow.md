An interactive runner is a live pod with a browser or a mobile device in it. You launch one, look at it, act on it, run flows on it, and read what it recorded. Everything is a plain request to one host, so there is no connection to hold open. This guide covers what spans commands; each command's own help below covers the rest.

## Which runner a command reaches

Commands that target a runner find one in this order: `--runner`, then `QAWOLF_RUNNER_ID`, then the runner stored for the current directory, which `qawolf runner launch` sets. Setting the environment variable once is the most robust for a harness whose working directory may not be stable, with two catches:

- `qawolf runner launch` is not in that order: it takes its id from `--id` and never reads `QAWOLF_RUNNER_ID`. Pass `--id` whenever you have an id in mind.
- A runner id that is set is treated as found, whether or not anything is running under it. Exporting `QAWOLF_RUNNER_ID=agent-1` turns off the auto-launch described next: instead of starting `agent-1`, commands try to reach it and fail with exit code `8`, naming the id and saying the variable is what chose it. Launch that id once yourself and the rest follows.

If nothing names a runner, the commands that change something launch one and say so on stderr, naming it: `run`, `act` and `exec`. Read that announcement. The browser it just started is fresh: nothing has been run on it, nothing is signed in, and no page is open. Acting as though your earlier setup survived is the single most likely way to drive the wrong page.

No read command ever launches a runner. `screenshot`, `events` and `keepalive` tell you there is no runner rather than quietly billing one, and so does `terminate`.

## The order that matters

A freshly launched runner has no screen. The virtual desktop starts with the runner's first run and nothing else starts it, so until you have run something:

- `screenshot` and `act` fail with exit code `2`, except `navigate`, which fails with exit code `1` (`action-failed`): it skips the screen but still needs the runner to have run something
- `exec` fails with exit code `2`
- `events recorder` reads as empty

None of that is a fault, and none of it clears on its own. Only `qawolf runner run <flow>` starts the screen. A bare navigate does not: it fails until the first run, however long you wait.

So the first thing you do to a new runner has to put a browser on it. That means a flow file and a `package.json` on disk, even if all you want is to drive the browser by hand; there is no "just give me a screen" call. Once one run has happened, the screenshot-and-act loop works for the rest of the runner's life. A `--lines` selection is the one call that does not need a run first.

## Exit codes

Retry on the exit code, not on the message text:

- `4` is transient, with one exception. The screen is up but cannot serve this instant: restarting after a display-size change, or busy with another request. Retry in a second or two, and bound the retries. The exception is a command that changes something, where a `4` can instead mean the answer was lost with the work in flight. For `act` and `actions`, take a screenshot first and repeat only what the screen says did not happen. For `run`, poll `run-status` instead of submitting again, since a second submission risks a second billed run. For `exec`, check the effect the snippet was meant to have before running it again.
- `6` means the work ran out of the time it is given.
- `8` means there is no such runner. It was never launched, or it was terminated, or it idled out. Retrying never brings one back, so stop and launch the id or name one that is running. The message says which runner was meant and whether `--runner`, `QAWOLF_RUNNER_ID` or this directory's stored default chose it; read that line before you pick an id to launch.
- `2` will not clear on its own. Nothing has run on this runner yet, so run a flow; or the runner has no browser at all, so launch with `--name playwright` instead; or the action belongs to the other runner family, so send `tap`, `swipe` or `fill` to a mobile runner and the browser actions to a browser runner. The message says which.

`act`, `actions`, `run` and `exec` are the commands whose lost answer may still have taken effect.

## End to end

Run from a directory holding a flow and a `package.json`. The run is what starts the screen, so it is not optional even though the goal here is to drive by hand.

```sh
export QAWOLF_API_KEY=...          # the only credential
export QAWOLF_RUNNER_ID=agent-1    # so no command below needs --runner

qawolf runner launch --id agent-1 --json          # --id, not the variable; read .alreadyRunning and .url
qawolf runner run flows/smoke.flow.ts --follow    # starts the screen; exit 1 if it failed

qawolf runner act navigate --url https://example.com/login --screenshot step-1.jpg   # then read step-1.jpg yourself
qawolf runner act click --button left --x 480 --y 260 --screenshot step-2.jpg
qawolf runner act type --text "someone@example.com" --screenshot step-3.jpg

qawolf runner inspect element-html --selector "#email"
qawolf runner inspect variable --name cart | jq .total

qawolf runner run flows/smoke.flow.ts --lines 12-40 --follow   # just those lines
qawolf runner events recorder --tail 5 | jq -r '[.locator] + (.alternates // []) | @tsv'
qawolf runner terminate
```

On a mobile runner, launch with `--name android` or `--name ios`, and drive it with `tap`, `swipe`, `fill` and `type` instead of the browser actions.
