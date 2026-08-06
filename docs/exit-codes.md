# Exit Codes

CI consumers depend on consistent exit codes. The CLI commits to the following codes; do not introduce new ones without updating this document and the central helper in [`src/shell/exit.ts`](../src/shell/exit.ts).

| Code | Name          | Meaning                                                                                                                     |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `0`  | `success`     | Command completed successfully.                                                                                             |
| `1`  | `testFailure` | A flow failed (non-zero result from running tests), including a `qawolf runner run --follow` whose run did not pass.        |
| `2`  | `invalidArgs` | Commander parse error, unknown subcommand, bad flag value, no runner available, or a flow needing a different runner image. |
| `3`  | `auth`        | Missing or invalid `QAWOLF_API_KEY`.                                                                                        |
| `4`  | `network`     | Apex unreachable, GCS download failure, registry unreachable, or an interactive runner that could not be reached.           |
| `5`  | `config`      | `qawolf.config.ts` invalid, or file collision during `init`.                                                                |

## Using the helper

Use `exit(code, message?)` from `src/shell/exit.ts` to terminate command execution with a code from this spec. The helper writes `message` to stderr (when provided) and calls `process.exit(code)`. Existing command paths that still set `process.exitCode` directly will be migrated incrementally as per-command tickets land.

```ts
import { exitCodes, exit } from "~/shell/exit.js";

exit(exitCodes.invalidArgs, 'Unknown command "foo"');
```
