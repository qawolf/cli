# @qawolf/cli — Agent Instructions

CLI for agents, CI, and humans to interact with QA Wolf. TypeScript, Bun runtime, Commander.js framework.

## Commands

```bash
bun install                        # install dependencies
bun run dev                        # run CLI in development
bun run dev -- <args>              # pass args to CLI (e.g. -- --help)
bun run build                      # JS bundle → dist/cli.js
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

Tests use bun:test. Run a single test file with `bun run test <path>`. Place test files next to the code they test, named `*.test.ts`.

## Project Structure

```
src/
├── main.ts              # Entry point: program setup + command registration + parse
├── commands/            # One directory per command domain
│   ├── auth/            # whoami
│   ├── flows/           # list, download
│   ├── runs/            # trigger
│   ├── diff/            # hash (content-stable change hashing)
│   └── pr/              # context (PR diff, comments, reviewer state)
├── clients/             # API client modules (one per auth boundary)
│   ├── platform.ts      # tRPC client + QAWOLF_API_KEY resolution
│   └── github.ts        # GitHub API + GITHUB_TOKEN resolution
└── lib/                 # Shared utilities
    ├── program.ts       # createProgram() factory
    ├── output.ts        # JSON / Markdown / human formatting
    └── config.ts        # env-paths, credentials
actions/                 # GitHub Action wrappers
plugins/                 # Claude Code plugin
skills/                  # Agent skills (agentskills.io format)
```

Commands are organized by **domain** — one directory per top-level CLI namespace. Each directory contains command registration, handler logic, and colocated types.

API clients live in `clients/` — one module per auth boundary. Command handlers import the client they need.

`lib/` contains cross-cutting concerns: output formatting (JSON/Markdown/Clack), config, and the program factory.

## Code Style

- Prefer string unions over enums
- Colocate types with their domain (`commands/flows/` exports `FlowListItem`, not a shared types dir)
- Organize directories by meaning, not by shape

## After Editing

Run `bun run lint:fix` and `bun run format` on changed files. Do not make cosmetic or stylistic changes to files unrelated to your task.

A pre-commit hook (`.githooks/pre-commit`) runs lint, format check, `knip`, and typecheck automatically. Activate it once per clone with `bun install`.

## Output Modes

The CLI auto-detects its context:

- `stdout.isTTY` true → Clack UI (styled tables, spinners, prompts)
- Piped / CI / `--json` flag → structured JSON
- `--agent` flag or agent env vars → Markdown

All required inputs are passable as flags so agents never hit interactive prompts.

## Git Conventions

Conventional commits: `type(scope): description`

- **Types:** feat, fix, build, chore, docs, refactor, test
- **Scopes:** scaffold, auth, flows, runs, diff, pr, config, cli, lib, clients
- Imperative mood ("add", not "added"). Subject line under 72 characters.

## Boundaries

- Do not modify `dist/` — it is build output
- Do not commit `.env` files or API keys
- Do not add dependencies without justification
- The CLI is a thin client — business logic belongs in the platform API, not here
- When adding a hacky workaround, add a `TODO TECH-0000` comment to track it
