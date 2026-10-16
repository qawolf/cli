An interactive runner is a live pod with a browser or a mobile device in it. You launch one, look at it, act on it, run flows on it, and read what it recorded. Everything is a plain request to one host, so there is no connection to hold open. This guide covers what spans commands; each command's own help below covers the rest.

## Which runner a command reaches

Commands that target a runner find one in this order: `--runner`, then `QAWOLF_RUNNER_ID`, then the runner stored for the current directory, which `qawolf runner launch` sets. Setting the environment variable once is the most robust for a harness whose working directory may not be stable, with two catches:

- `qawolf runner launch` is not in that order: it takes its id from `--id` and never reads `QAWOLF_RUNNER_ID`. Pass `--id` whenever you have an id in mind.
- A runner id that is set is treated as found, whether or not anything is running under it. Exporting `QAWOLF_RUNNER_ID=agent-1` turns off the auto-launch described next: instead of starting `agent-1`, commands try to reach it and fail with exit code `8`, naming the id and saying the variable is what chose it. Launch that id once yourself and the rest follows.

If nothing names a runner, the commands that change something launch one and say so on stderr, naming it: `run`, `act`, `actions` and `exec`. Read that announcement. The browser it just started is fresh: nothing has been run on it, nothing is signed in, and it shows only the QA Wolf welcome page. Acting as though your earlier setup survived is the single most likely way to drive the wrong page.

No read command ever launches a runner. `screenshot`, `events` and `keepalive` tell you there is no runner rather than quietly billing one, and so does `terminate`.

## The order that matters

A playwright runner's screen starts as it launches, showing a QA Wolf welcome page, so the screenshot-and-act loop works before you run anything.

Any other runner, such as a mobile one, has no screen until its first run, and nothing else starts it. Until you have run something on it, `screenshot` and `act` fail with exit code `2`. That is not a fault, and it does not clear on its own: run a flow with `qawolf runner run <flow>`, which needs a flow file and a `package.json` on disk.

## Exit codes

Retry on the exit code, not on the message text:

- `4` is transient, with one exception. The screen cannot serve this instant: still coming up just after launch, restarting after a display-size change, or busy with another request. Retry in a second or two, and bound the retries. The exception is a command that changes something, where a `4` can instead mean the answer was lost with the work in flight. For `act` and `actions`, take a screenshot first and repeat only what the screen says did not happen. For `run`, poll `run-status` instead of submitting again, since a second submission risks a second billed run. For `exec`, check the effect the snippet was meant to have before running it again.
- `6` means the work ran out of the time it is given.
- `7` means billing prevented the request, such as a plan that does not cover the runner you asked for. The message says what was refused and what clears it.
- `8` means there is no such runner. It was never launched, or it was terminated, or it idled out. Retrying never brings one back, so stop and launch the id or name one that is running. The message says which runner was meant and whether `--runner`, `QAWOLF_RUNNER_ID` or this directory's stored default chose it; read that line before you pick an id to launch.
- `2` will not clear on its own. Nothing has run on this runner yet, so run a flow; or the runner has no browser at all, so launch with `--name playwright` instead; or the action belongs to the other runner family, so send `tap`, `swipe` or `fill` to a mobile runner and the browser actions to a browser runner. The message says which.

`act`, `actions`, `run` and `exec` are the commands whose lost answer may still have taken effect.

## End to end

Run from a directory holding a flow and a `package.json`.

```sh
export QAWOLF_API_KEY=...          # the only credential
export QAWOLF_RUNNER_ID=agent-1    # so no command below needs --runner

qawolf runner launch --id agent-1 --json          # --id, not the variable; read .alreadyRunning and .url
qawolf runner run flows/smoke.flow.ts --follow    # exit 1 if it failed

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
