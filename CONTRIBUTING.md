# Contributing

## Contribution policy

QA Wolf currently maintains `@qawolf/cli` internally and isn't accepting external pull requests yet. Bug reports and feature requests via [GitHub Issues](https://github.com/qawolf/cli/issues) are very welcome.

## Setup

```bash
bun install
```

This also activates the pre-commit hook (runs the naming check, lint, format check, typecheck, and knip before each commit) via the prepare script.

## Development

```bash
bun run dev                  # run the CLI
bun run dev -- <args>        # pass args (e.g. -- --help)
```

## Build

```bash
bun run build                # JS bundle → dist/cli.js (npm distribution)
bun run build:binary         # standalone binary → dist/qawolf (no runtime needed)
```

## Quality

```bash
bun run typecheck            # tsc --noEmit
bun run lint                 # oxlint
bun run lint:fix             # oxlint with auto-fix
bun run format:check         # oxfmt check
bun run format               # oxfmt write
bun run knip                 # unused files, dependencies, and exports
bun run test                 # run all tests
bun run test:watch           # run tests in watch mode
bun run test <path>          # run a single test file
```

Run `bun run lint:fix` and `bun run format` after editing files.

## Project structure

```
src/
├── main.ts              # Entry point
├── core/                # Pure functions and types — zero I/O
├── shell/               # I/O executors — spawning, UI, API clients
├── domains/             # Business logic, one directory per bounded context
└── commands/            # Thin Commander registration + composite root
```

The codebase has four strict layers. `core/` is pure. `shell/` handles I/O. `domains/` holds bounded-context logic and may import `core/` and `shell/` but not sibling domains. `commands/` is the composite root.

## Reference

- [Exit codes](docs/exit-codes.md)
