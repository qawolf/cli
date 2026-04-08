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
bun run lint             # ESLint
bun run lint:fix         # ESLint with auto-fix
bun run format:check     # Prettier check
bun run format           # Prettier write
bun run test             # Vitest
```

Run everything at once with Turborepo (cached, parallel):

```bash
bunx turbo run typecheck lint build
```

## License

[Apache-2.0](LICENSE)
