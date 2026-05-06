# Exit Codes

CI consumers depend on consistent exit codes. The CLI commits to the following codes; do not introduce new ones without updating this document and the central helper in [`src/exit.ts`](../src/exit.ts).

| Code | Name          | Meaning                                                       |
| ---- | ------------- | ------------------------------------------------------------- |
| `0`  | `success`     | Command completed successfully.                               |
| `1`  | `testFailure` | A flow failed (non-zero result from running tests).           |
| `2`  | `invalidArgs` | Commander parse error, unknown subcommand, or bad flag value. |
| `3`  | `auth`        | Missing or invalid `QAWOLF_API_KEY`.                          |
| `4`  | `network`     | Apex unreachable, GCS download failure, registry unreachable. |
| `5`  | `config`      | `qawolf.config.ts` invalid, or file collision during `init`.  |

## Using the helper

Every command path must exit through `exit(code, message?)` from `src/exit.ts`. The helper writes `message` to stderr (when provided) and calls `process.exit(code)`.

```ts
import { EXIT_CODES, exit } from "~/exit.js";

exit(EXIT_CODES.invalidArgs, 'Unknown command "foo"');
```
