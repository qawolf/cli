# @qawolf/cli

Tools for agents, CI, and humans to interact with QA Wolf.

## Setup

```bash
bun install
```

## Development

```bash
bun run dev              # run the CLI
bun run dev -- --help    # show help
bun run dev -- --version # show version
```

## Build

```bash
bun run build            # JS bundle → dist/cli.js (npm distribution)
bun run build:binary     # standalone binary → dist/qawolf (no runtime needed)
```

## Quality

```bash
bun run typecheck        # type check with tsc
bun run lint             # oxlint
bun run lint:fix         # oxlint with auto-fix
bun run format:check     # oxfmt check
bun run format           # oxfmt write
bun run knip             # unused files, dependencies, and exports
bun run test             # Vitest
```

## Contributing

- [Exit codes](docs/exit-codes.md) — canonical exit codes the CLI commits to and the central `exit()` helper.

## License

[Apache-2.0](LICENSE)
