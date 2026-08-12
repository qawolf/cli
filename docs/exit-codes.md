# Exit Codes

CI consumers depend on consistent exit codes. The CLI commits to the following codes; do not introduce new ones without updating this document and the central helper in [`src/shell/exit.ts`](../src/shell/exit.ts).

| Code | Name          | Meaning                                                                                                                                                                                               |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`  | `success`     | Command completed successfully.                                                                                                                                                                       |
| `1`  | `testFailure` | A flow failed (non-zero result from running tests); a `qawolf runner run --follow` whose run did not pass; a runner action or snippet that was attempted and did not succeed.                         |
| `2`  | `invalidArgs` | Commander parse error, unknown subcommand, bad flag value, no runner available, a flow needing a different runner image, or a runner asked for something it can never do (no screen to see or drive). |
| `3`  | `auth`        | Missing or invalid `QAWOLF_API_KEY`.                                                                                                                                                                  |
| `4`  | `network`     | Apex unreachable, GCS download failure, registry unreachable, or a runner that could not serve the request now (unreachable, or its screen not yet up).                                               |
| `5`  | `config`      | `qawolf.config.ts` invalid, file collision during `init`, or a run file that could not be read.                                                                                                       |
| `6`  | `timeout`     | A `--follow` reached its `--timeout`: `runner run` before its run settled (the run may still be going), or `runner events`.                                                                           |

## Using the helper

Use `exit(code, message?)` from `src/shell/exit.ts` to terminate command execution with a code from this spec. The helper writes `message` to stderr (when provided) and calls `process.exit(code)`. Existing command paths that still set `process.exitCode` directly will be migrated incrementally as per-command tickets land.

```ts
import { exitCodes, exit } from "~/shell/exit.js";

exit(exitCodes.invalidArgs, 'Unknown command "foo"');
```
