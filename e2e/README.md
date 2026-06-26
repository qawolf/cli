# e2e — isolated repo-readiness E2E framework

A manually-run, high-level end-to-end harness that drives the **real built CLI**
across a data-driven matrix of repo shapes. It exists to prove `qawolf flows run`
works on every project/monorepo layout, on **both** the Node and compiled-binary
channels, with zero project pollution — repeatably and with a clean report.

It is **not** part of the product and **not** a constant CI gate. Run it by hand
when you want to verify that runtime-deps resolution still holds across shapes.

## What it is & why it's isolated

The harness treats the CLI as a **subprocess black box**. It imports **nothing**
from `src/` — it builds the CLI, then spawns the built artifacts and asserts on
exit code, JUnit output, and on-disk side effects.

Isolation guarantees:

- **Run by reference, no global mutation.** It runs `bun run build:binary` once
  (which produces `dist/cli.js` _and_ `dist/qawolf` in one pass), then spawns those
  artifacts directly — `node dist/cli.js …` for the node channel, `dist/qawolf …`
  for the binary channel. No global install, no `npm link`, no `~/.local/bin`
  changes.
- **Isolated managed runtime.** Each run points `QAWOLF_RUNTIME_DIR` at a throwaway
  tmp dir, so it never touches the real `~/Library/Application Support/qawolf-nodejs`.
  The dir is shared across all cases in a run so the runtime + browser download
  warms once per channel (the managed runtime keys node vs binary by hash
  internally), then is removed on cleanup.
- **Throwaway project dirs.** Every case materializes its shape into a fresh
  `mkdtemp` project dir and removes it afterward (unless `--no-cleanup`).
- **No `src/` coupling.** `report.ts` uses `@clack/prompts` directly rather than
  `src/shell/ui`. The CLI is only ever a spawned process.

## How to run

```bash
bun run e2e -- repo-readiness                     # full matrix, both channels
bun run e2e -- repo-readiness --channel node      # node channel only
bun run e2e -- repo-readiness --channel binary    # binary channel only
bun run e2e -- repo-readiness --no-cleanup        # keep tmp dirs (prints retained paths)
bun run e2e -- repo-readiness --json              # structured output (also the non-TTY fallback)
```

There is a **single** `e2e` script by design — the suite is a positional arg, not a
per-suite script. You can equivalently run `bun e2e/run.ts repo-readiness`. Omitting
the suite name runs every registered suite.

The first positional that doesn't start with `--` is the suite name; `--channel`
takes `node`, `binary`, or `both` (default `both`). `--no-cleanup` prints the
retained workspace path in each cell's output for debugging. `--json` (or any
non-TTY stdout) emits `{ results, exitCode }` instead of the Clack report.

> **First run is slow.** Each channel builds its artifact and warms the managed
> runtime + browser exactly once. Subsequent runs reuse the build and are fast.

The process exits non-zero if any cell fails.

## The repo-shape matrix

Eight cases × two channels = 16 cells. Cases 01–07 use the simple flow
(`simpleNav` — navigates `example.com`, no QA Wolf account needed). Case 08 is the
hard one.

| #   | Shape                                                                                        | Proves                                                            |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 01  | flow only, **no `package.json`**                                                             | runs with nothing to resolve                                      |
| 02  | npm single-package (ESM)                                                                     | baseline                                                          |
| 03  | single + `bun.lock`                                                                          | bun single                                                        |
| 04  | npm workspace, flow in **leaf, no leaf `node_modules`**                                      | originally-reported monorepo failure                              |
| 05  | pnpm workspace (`pnpm-workspace.yaml` + lock)                                                | pnpm workspace                                                    |
| 06  | yarn workspace (`workspaces` + `yarn.lock`)                                                  | yarn workspace                                                    |
| 07  | bun workspace (`workspaces` + `bun.lock`)                                                    | bun workspace                                                     |
| 08  | declares `diff@^8.0.3` + `sharp`, flow imports `FILE_HEADERS_ONLY` from `diff`, runs `sharp` | inner-hop version-shadowing fix **and** binary native-module load |

Per-case assertions (all must hold, see `harness/assertions.ts`):

1. **CLI exits 0** and JUnit reports `failures="0"` and `errors="0"` with at least
   one test (a missing JUnit file, or `tests="0"`, is also a failure — it means the
   flow never executed).
2. **Zero project pollution** — no `node_modules` dir written into the project tree
   outside the isolated `.qawolf/` cache.
3. **Case 08 only** — output/JUnit contains **none** of the forbidden regression
   strings: `FILE_HEADERS_ONLY`, `Could not load the "sharp" module`,
   `Cannot find package`.

## How to add a CASE

A case is a `RepoShape` pushed onto `repoShapes` in `fixtures/shapes.ts`. If it
needs new file bodies, add them as content consts in `fixtures/shapeFiles.ts`
first (verbatim, byte-for-byte) and import them.

The `RepoShape` shape (`harness/types.ts`):

```ts
type RepoShape = {
  readonly name: string; // e.g. "09-deno-single" — also keys case-08 assertions ("08"/"native")
  readonly proves: string; // one-line description of what this shape exercises
  readonly files: readonly ShapeFile[]; // { path, content }[] — excludes the flow itself
  readonly flow: FlowTemplate; // "simpleNav" | "nativeAndVersioned"
  readonly runDir: string; // subdir to run `flows run` from ("" = project root)
  readonly flowArg: string; // flow path relative to runDir, passed to `flows run`
};
```

The harness writes each `files` entry, then writes the named flow template at
`join(runDir, flowArg)`, then spawns `flows run <flowArg> --junit <out>` with
`cwd = join(projectDir, runDir)`. Concrete example:

```ts
{
  name: "02-npm-single",
  proves: "npm single-package (ESM) — baseline",
  files: [{ path: "package.json", content: npmSinglePackageJson }],
  flow: "simpleNav",
  runDir: "",
  flowArg: "src/flows/smoke/compat-smoke.flow.ts",
}
```

For a workspace shape, point `runDir` at the leaf (e.g. `"packages/app"`) and add
the root + leaf manifests to `files`.

## How to add a SUITE

Adding a suite is a **one-file change plus one registry line**.

1. Drop `suites/<name>.ts` exporting a `Suite`:

```ts
// suites/smokeOnly.ts
import { repoShapes } from "../fixtures/shapes.js";
import type { Suite } from "../harness/types.js";

/** Smoke-only: the first two shapes, node channel only. */
export const smokeOnlySuite: Suite = {
  name: "smoke-only",
  cases: repoShapes.slice(0, 2),
  channels: ["node"],
};
```

2. Register it in `suites/index.ts`:

```ts
import { smokeOnlySuite } from "./smokeOnly.js";

const suites: Record<string, Suite> = {
  [repoReadinessSuite.name]: repoReadinessSuite,
  [smokeOnlySuite.name]: smokeOnlySuite,
};
```

Run it with `bun run e2e -- smoke-only`. No harness changes — `run.ts` resolves any
registered suite by name, builds only the channels the suite declares, and reports.

## Layout

```
e2e/
├── README.md
├── run.ts                       # entry: parse args, resolve suite(s), run case × channel, report, exit
├── harness/
│   ├── types.ts                 # Channel, RepoShape, Suite, CaseResult, ShapeFile, FlowTemplate
│   ├── channels.ts              # resolveChannels(): build once → run-by-reference channels
│   ├── tmpWorkspace.ts          # createRuntimeRoot() + createTmpProject(): isolated dirs + QAWOLF_RUNTIME_DIR
│   ├── materialize.ts           # write a RepoShape (files + flow template) into a tmp dir
│   ├── spawnCli.ts              # node:child_process spawn → { exitCode, stdout, stderr } (never rejects)
│   ├── runCase.ts               # spawn the CLI on one case/channel → CaseResult
│   ├── assertions.ts            # parseJunit, assertExitAndJunit, scanPollution, assertCase08Strings
│   └── report.ts                # @clack/prompts report (or --json/non-TTY); returns exit code
├── fixtures/
│   ├── flows/                   # opaque flow template assets (see note below)
│   │   ├── simpleNav.flow.ts
│   │   └── nativeAndVersioned.flow.ts
│   ├── shapes.ts                # repoShapes: the 8 RepoShape builders
│   └── shapeFiles.ts            # verbatim project-file bodies (package.json, lockfile stubs)
└── suites/
    ├── index.ts                 # registry: getSuite(name), allSuites()
    └── repoReadiness.ts         # first suite: 8 cases, [node, binary]
```

## Note on flow templates

`fixtures/flows/*.flow.ts` are **opaque fixture assets**. The harness reads them as
**text** and writes them into the tmp project; the CLI subprocess is what actually
executes them. They import dependencies this repo does not have (`sharp`, `diff`,
`@qawolf/flows`), so they are deliberately excluded from this repo's tooling:

- `tsconfig.json` — `exclude: ["…", "e2e/fixtures/flows"]`
- `.oxlintrc.json` — `ignorePatterns: ["…", "e2e/fixtures/flows/"]`
- `.oxfmtrc.json` — `ignorePatterns: ["…", "e2e/fixtures/flows/"]`
- `knip.config.ts` — `ignore: ["e2e/fixtures/flows/**"]` (they're never imported)

The rest of `e2e/` **is** covered by typecheck, lint, format, and knip. Keep each
module under 150 lines and use `node:` builtins (the `Bun` global is banned by
oxlint in this tree).
