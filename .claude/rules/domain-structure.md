---
description: Four-layer architecture and import boundaries for src/
globs: src/**
---

## Four-layer architecture

Import rules are enforced by oxlint:
- `core/`: no imports from `shell/`, `domains/`, or `commands/`
- `shell/`: no imports from `domains/` or `commands/`
- `domains/<x>/`: no imports from `commands/`; no imports from sibling domains
- `commands/`: composite root — may import any layer

## Adding a command

1. Create the handler directory under `src/commands/<domain>/`
2. Export a registration function (`registerXCommand`) that takes a Commander `program` instance
3. In the registration function, use `withContext` from `~/commands/context.js` to wrap each action
4. Extract pure business logic to `src/domains/<domain>/`; keep commands/ files as thin wiring
5. Import I/O utilities (spawn, playwright, UI) from `src/shell/`
6. Import pure helpers and types from `src/core/`

Do not put business logic in `commands/`. If a handler grows beyond wiring dependencies to a domain function, the excess belongs in `domains/`.

## Adding domain logic

1. Create or extend a directory under `src/domains/<domain>/`
2. Domain files may import from `src/core/` and `src/shell/`
3. Domain files must not import from `src/commands/` or from a sibling domain (`~/domains/<other>/`)
4. Cross-domain shared types go in `src/core/` (pure types) or `src/shell/` (types that reference UI or I/O)
5. Colocate tests as `<name>.test.ts` next to the source file

## Adding shell utilities

1. Place I/O executors in `src/shell/`
2. Shell files may import from `src/core/` and other `src/shell/` files
3. Shell files must not import from `src/domains/` or `src/commands/`

## Adding pure utilities or types

1. Place in `src/core/`
2. Core files must not import from any other src/ layer

## Do not create

- Shared types directories — types belong with the layer that owns them
- A new `src/lib/` or `src/clients/` directory — these are replaced by `shell/` and `domains/`
