---
description: Conventional commit format for this repo
globs: "**"
---

Use conventional commit format: `type(scope): description`

**Types:** feat, fix, build, chore, docs, refactor, test

**Scopes:** scaffold, auth, flows, runs, diff, pr, config, cli, lib, clients

**Examples from this repo:**

- `feat(scaffold): add directory structure and minimal Commander app`
- `build(config): add package.json, tsconfig, oxlint, oxfmt`
- `docs(readme): add development commands and turbo usage`
- `chore(license): switch from MIT to Apache-2.0`

Keep the subject line under 72 characters. Use imperative mood ("add", not "added"). Body is optional — use it for "why" when the diff doesn't make it obvious.
