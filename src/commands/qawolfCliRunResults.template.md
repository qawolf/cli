# Reading a run's results

How to use what `qawolf run get --run-id <id> --json` returns, and how to read
the Playwright trace it links to.

Call `run get` with `--json` and you see most of the response immediately. Read
this file for the parts a single response cannot show you: fields that appear
only when something fails, rules about the artifact URLs, and how to read a
trace without opening the trace viewer.

## The shape

A run holds flows, a flow holds attempts, and artifacts hang off an attempt:

```text
run
└── flows[]
    ├── failure          only when the flow failed
    └── attempts[]       oldest first
        ├── logsUrl
        ├── traceUrl
        └── videoUrl
```

`runId` in the response is canonical and can differ from the id you asked for.
Use the returned value for follow-up calls.

Poll `status` until it reaches `passed`, `failed` or `canceled`. The other
values mean the run is still going.

## Fields a passing run does not show you

- `flows[].failure` exists only when a flow failed. Every flow passing means
  there is no failure object at all, so its diagnosis and issue id are invisible
  until something breaks. Do not conclude the field does not exist.
- `git` is populated only when a deploy notification started the run. A run
  started manually or with `run create` has an empty object here.
- An attempt's `kind` and `status` select which other fields it has. Only
  automated attempts that reached a verdict carry artifact URLs; canceled
  attempts and manual Wolf Browser attempts carry none.
- A flow that passed after a retry still lists its failed attempts. Read the
  last attempt for the outcome, and the earlier ones to see what went wrong.

## Artifact URLs

Each automated attempt links `logsUrl` (execution logs), `videoUrl` (screen
recording) and `traceUrl` (a Playwright `trace.zip`).

1. They are signed URLs with a limited life. The contract guarantees at least a
   day. Call `run get` again for fresh ones instead of storing them; a stored
   URL becomes a dead link.
2. A URL can return 404 when that attempt did not produce that artifact. Handle
   the 404 rather than treating the URL's presence as a guarantee of content.
3. Download with a plain HTTP GET. The signature is in the URL, so no
   authentication header is needed and no QA Wolf credentials are involved.

```bash
qawolf run get --run-id "$RUN_ID" --json \
  | jq -r '.flows[].attempts[-1].traceUrl // empty' \
  | head -1 \
  | xargs -r curl -sS -o trace.zip
```

## Reading the Playwright trace

The usual advice is `npx playwright show-trace trace.zip`, which opens a
browser window. That is useless in a shell and unnecessary: the zip holds
newline-delimited JSON files, and reading them directly is faster than
downloading a viewer.

The zip holds `trace.trace` (the events), `trace.network` (one request and
response per line) and a `resources/` directory of screencast frames. The
frames are most of the size, so extract only what you need.

### The event types

Every line of `trace.trace` is one JSON object with a `type`:

- `before` — a call started. Carries `callId`, `startTime`, `class`, `method`
  and `params`. `params.selector` or `params.url` is usually the target.
- `after` — that call finished. Matched to its `before` by `callId`. Carries
  `endTime` and `result`, and an `error` when the call failed.
- `console` — a browser console message, with `messageType` and `text`.
- `log` — Playwright's own progress notes for a call.
- `screencast-frame`, `frame-snapshot` — the filmstrip and DOM snapshots the
  viewer renders. Usually not worth reading directly.

Two details cost time if you miss them:

- **Times are monotonic milliseconds, not seconds.** A `goto` whose `startTime`
  and `endTime` differ by `161.6` took 161 milliseconds. Subtract the smallest
  `startTime` to get an offset from the start of the trace.
- **Return values use a serialized envelope.** `{"value":{"s":"passed"}}` is
  the string `passed`, `{"n":640}` is the number `640`, and `{"o":[...]}` is an
  object as a list of key and value pairs.

### A worked example

Pairing `before` with `after` gives an action timeline with durations and
failures:

```python
import json, sys, zipfile

with zipfile.ZipFile(sys.argv[1]) as z:
    events = [json.loads(line) for line in z.read("trace.trace").decode().splitlines()]

starts = {e["callId"]: e for e in events if e["type"] == "before"}
ends = {e["callId"]: e for e in events if e["type"] == "after"}
t0 = min(e["startTime"] for e in starts.values())

for call_id, before in starts.items():
    after = ends.get(call_id, {})
    params = before.get("params", {})
    target = params.get("selector") or params.get("url") or ""
    error = after.get("error")
    print(
        f'{(before["startTime"] - t0) / 1000:7.2f}s'
        f' {after.get("endTime", before["startTime"]) - before["startTime"]:7.1f}ms'
        f'  {before["class"]}.{before["method"]:<18} {target[:40]}'
        f'{"  FAILED: " + json.dumps(error)[:60] if error else ""}'
    )

for e in events:
    if e["type"] == "console" and e["messageType"] == "error":
        print(f'console error: {e["text"][:70]}')
```

It prints one line per call, in order:

```text
   0.00s   161.6ms  Frame.goto               https://example.com/
   0.17s    28.3ms  Frame.waitForSelector    #screen
   0.20s     4.2ms  Frame.innerText          #fps_stats
console error: Failed to load resource: the server responded with a status of 404 ()
```

To find why an attempt failed, read the last `after` that carries an `error`,
then the `console` errors near it in time. To see what the page did, read
`trace.network`.

## Response fields

Every documented field of the `run.get` response. `[]` marks an array, so
`flows[].attempts[].traceUrl` is the trace URL of one attempt of one flow.

<!-- fields:start — generated by `bun run generate`, do not edit -->
<!-- fields:end -->
