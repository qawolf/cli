---
description: Domain-based project structure for CLI commands and modules
globs: src/**
---

## Adding a command

1. Create the command directory under `src/commands/<domain>/`
2. Export a registration function that takes a Commander program instance
3. Colocate types, Zod schemas, and handler logic within the domain directory
4. Import API clients from `src/clients/` (one module per auth boundary)
5. Import shared utilities from `src/lib/`

Do not create a shared types directory. Types belong with their domain.

## Adding an API client

1. Create the client module in `src/clients/`
2. Each client module owns one auth boundary (e.g., `platform.ts` owns `QAWOLF_API_KEY`)
3. Export a configured client instance that command handlers import

## Adding shared utilities

1. Place them in `src/lib/`
2. Utilities must be cross-cutting concerns: output formatting, config, program factory
3. If it's domain-specific, it belongs in the command directory instead
