# @qawolf/cli — Agent Instructions

CLI for agents, CI, and humans to interact with QA Wolf. TypeScript, Bun runtime, Commander.js framework.

See [CONTRIBUTING.md](CONTRIBUTING.md) for human contributor setup.

## Commands

```bash
bun install                        # install dependencies
bun run dev                        # run CLI in development
bun run dev -- <args>              # pass args to CLI (e.g. -- --help)
bun run build                      # JS bundle → dist/cli.js + dist/cli.js.map (uses --outdir; bun rejects --sourcemap=external with --outfile)
bun run build:binary               # standalone binary → dist/qawolf
bun run typecheck                  # tsc --noEmit
bun run lint                       # oxlint
bun run lint:fix                   # oxlint with auto-fix
bun run format:check               # oxfmt check
bun run format                     # oxfmt write
bun run knip                       # dead-code / unused-dep detection
bun run test                       # bun test
bun run test:watch                 # bun test --watch
```

## Testing

Tests use Bun's test runner. Run a single test file with `bun run test <path>`. Place test files next to the code they test, named `*.test.ts`.

## Project Structure

```
src/
├── main.ts              # Entry point — createProgram().parse()
├── core/                # Pure functions and types — zero I/O
│   ├── androidBins.ts   # Android SDK binary paths per platform
│   ├── androidTargets.ts # Android target parsing helpers
│   ├── batchMap.ts      # bounded-concurrency async map
│   ├── errors.ts        # errorMessage, isNoEntError
│   ├── flowMeta.ts      # extractFlowMeta, targetToBrowser, flowBasename
│   ├── messages/        # user-facing strings (auth, doctor, flows, init, install, runner)
│   ├── nodeModulesBins.ts # node_modules/.bin shim candidates per platform
│   ├── paths.ts         # getConfigDir
│   ├── patternArgs.ts   # CLI pattern argument parsing
│   ├── pluralize.ts     # pluralize
│   ├── sleep.ts         # sleep
│   ├── types.ts         # BrowserName, VideoMode, TraceMode, HarMode, TestCounts
│   └── version.ts       # isNewerVersion
├── shell/               # I/O executors — process spawning, UI, API clients
│   ├── appium/          # Android emulator + Appium server lifecycle
│   ├── commandContext.ts # CommandContext, CommandResult types
│   ├── exit.ts          # exitCodes, exit
│   ├── fs.ts            # filesystem helpers
│   ├── logger.ts        # pino-based structured logger
│   ├── manifest/        # bundle manifest read/lookup
│   ├── npm.ts           # resolveNpmCommand
│   ├── npmRegistry.ts   # fetchLatestVersion (update-check registry lookup)
│   ├── platform/        # tRPC client, getIdentity, signed-URL/bundle download, team storage
│   ├── reporter/        # Reporter interface, console + JUnit + composite reporters
│   ├── resolveExport.ts # ESM export resolution
│   ├── signals/         # SignalRegistry for graceful shutdown
│   ├── spawn.ts         # defaultSpawn, SpawnFn
│   ├── testkit.ts       # configureTestkit
│   ├── ui/              # createUI, detectOutputMode, OutputMode (clack + renderers)
│   └── workerCommand.ts # worker-subprocess command wiring
├── domains/             # Business logic — one directory per bounded context
│   ├── auth/            # resolveApiKey, validateApiKey, saveApiKey
│   ├── config/          # loadConfig (not yet wired)
│   ├── doctor/          # runChecks, renderResults
│   ├── emails/          # configureEmails (not yet wired)
│   ├── flows/           # expandPatterns, peekFlowMeta, flowsList, pull/
│   ├── init/            # init handler + templates
│   ├── install/         # installBrowsers, installBrowserList
│   ├── runner/          # flowsRun, runWebFlow, runAndroidFlow, worker dispatch + pool
│   └── updateCheck/     # startUpdateCheck: new-version notice after commands
└── commands/            # Thin CLI glue — Commander registration + composite root
    ├── context.ts       # withContext() Commander action wrapper
    ├── program.ts       # createProgram() factory
    ├── auth/            # login, logout, whoami handlers
    ├── doctor/          # doctor handler
    ├── flows/           # flows run/list/pull handlers; runDefaults composite root
    ├── init/            # init handler
    └── install/         # install browsers/android handlers
```

The codebase is organized into four strict layers. **`core/`** holds pure functions and types with zero I/O. **`shell/`** holds I/O executors (process spawning, Playwright, UI rendering, API clients). **`domains/`** holds bounded-context business logic; each domain may import `core/` and `shell/` but never a sibling domain. **`commands/`** is the composite root: thin Commander registration plus `runDefaults.ts`, which bridges multiple domains to assemble the `flows run` command. oxlint enforces these boundaries via per-layer `no-restricted-imports` overrides in `.oxlintrc.json`.

API clients (tRPC for the QA Wolf platform, GitHub REST) live in `src/shell/platform/` and `src/shell/` respectively — one module per auth boundary.

Commands register in one of two ways: platform public-API endpoints are generated from contracts via `registerPublicApiCommands` (`src/commands/publicApi/`), while commands with local logic or multi-step UX flows are hand-written under `src/commands/<domain>/`. Never both for the same endpoint — contracts served by a hand-written command go in the generator's skip-list (`handWrittenContractNames`). See `.claude/rules/domain-structure.md` ("Adding a command") for the full decision rule.

## Code Style

- Prefer string unions over enums
- Colocate types with their domain (`commands/flows/` exports `FlowListItem`, not a shared types dir)
- Organize directories by meaning, not by shape

## After Editing

Run `bun run lint:fix` and `bun run format` on changed files. Do not make cosmetic or stylistic changes to files unrelated to your task.

A pre-commit hook (`.githooks/pre-commit`) runs the naming check, lint, format check, typecheck, and `knip` automatically. Activate it once per clone with `bun install`.

## Output Modes

The CLI auto-detects its context:

- `stdout.isTTY` true → Clack UI (styled tables, spinners, prompts)
- Piped / CI / `--json` flag → structured JSON
- `--agent` flag or agent env vars → Markdown

All required inputs are passable as flags so agents never hit interactive prompts.

## Git Conventions

Conventional commits: `type(scope): description`

- **Types:** feat, fix, build, chore, docs, refactor, test
- **Scopes:** scaffold, auth, flows, runs, diff, pr, config, cli, lib, clients, runner
- Imperative mood ("add", not "added"). Subject line under 72 characters.

## Boundaries

- Do not modify `dist/` — it is build output
- Do not commit `.env` files or API keys
- Do not add dependencies without justification
- The CLI is a thin client — business logic belongs in the platform API, not here
- When adding a hacky workaround, file a follow-up ticket in Linear, then add a `TODO $TICKET_ID` comment to track it
