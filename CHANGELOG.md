# @qawolf/cli

## 1.2.0

### Minor Changes

- c2e13b2: Support Node 20. The `engines.node` floor is lowered to `>=20.19.0`, and on Node
  versions without native TypeScript support (Node 20, and Node 22.15–22.17) flows
  are now loaded through the `@oxc-node/core` ESM loader, which transpiles and
  resolves TypeScript at runtime. Bun and Node 22.18+ are unaffected. A CI matrix
  smoke-tests the published bundle on Node 20, 22, 24, and Bun.

  Note: the `@qawolf/*` platform packages currently declare `engines.node >=22.22.0`,
  so installing on Node 20 prints `EBADENGINE` warnings. They are verified to run on
  Node 20.19, and the warnings are non-fatal unless `engine-strict` is enabled.

### Patch Changes

- cae4b3d: Provide shared local flow runtime dependencies for email inboxes and environment variable persistence across web and Android flows.
- f69f2de: Fix `ERR_MODULE_NOT_FOUND` for correctly declared flow dependencies: dependency discovery now validates an ancestor `node_modules` before reusing it, and falls back to installing the project's declared deps when none satisfies them (reported as `Installing N project dependencies…`).

## 1.1.0

### Minor Changes

- 38f4903: Resolve flow runtime dependencies through a layered, project-isolated `node_modules` so flows run correctly in monorepos, single-package projects, and empty directories across both the Node and compiled-binary channels. The CLI-owned executor is always pinned and never pollutes or is shadowed by the surrounding project, while the flow's own declared dependencies still resolve. Adds `qawolf install clear` to wipe the managed runtime cache.

### Patch Changes

- 2d98dc9: Exit `flows run` deterministically once the run completes. The flow runtime can launch browser processes (e.g. a channel-launched Google Chrome) whose CDP sockets and timers keep Node's event loop alive after teardown, so the CLI previously printed its results and then hung indefinitely. The process now flushes stdout/stderr and exits with the run's exit code (1 on flow failure, 0 on pass) as soon as the command resolves, with a backstop in case a stream stalls.
- 5a81d70: Resolve the `#playwright` subpath import when running flows in the isolated managed runtime. QA Wolf flow bundles import Playwright through a Node.js `imports` alias (`#playwright`), but the pulled bundle's `package.json` omits the `imports` field, so the staged `exec/package.json` could not resolve it and flows failed with `ERR_PACKAGE_IMPORT_NOT_DEFINED`. The CLI now merges the `#playwright` alias into the staged `exec/package.json`, pointing it at the pinned Playwright resolved through the inner-hop `node_modules` symlink — fixing both the Node import path and the compiled-binary bundle path.
- 621f5d4: Resolve flow imports whose specifier uses a `.ts` extension but ships as `.js` (and vice versa). Platform-generated bundles often import sibling utilities as `.ts` while the file on disk is `.js`; native Node ESM resolves extensions literally and throws `ERR_MODULE_NOT_FOUND`. A synchronous `module.registerHooks` resolve hook now transparently retries the sibling source extension (`.ts`↔`.js`, `.mts`↔`.mjs`, `.cts`↔`.cjs`) only on resolution failure — literal matches always win and nothing is rewritten on disk. Raises the Node engine floor to `>=22.15.0`, the release that introduced synchronous hooks.

## 1.0.1

### Patch Changes

- 99e891c: Change the default `flows run` output directory from `qawolf-output` to `.qawolf/output`, so run artifacts (videos, traces, HAR) land under the `.qawolf/` directory that `qawolf init` gitignores. Pass `--output-dir` to override.
- f58d9cd: Save HAR and trace artifacts reliably from `flows run`. HAR (and video) could be silently dropped because contexts and browsers were closed concurrently, racing Playwright's artifact flush; contexts now close first. The `--trace` flag is now wired end-to-end and writes a Playwright trace to `<output-dir>/trace/<flow>.zip`, honoring `on`, `off`, and `retain-on-failure`.
- 3b4fdb7: Normalize the `bin` entry to `dist/cli.js` so npm no longer rewrites it (with a publish warning) when publishing.
- 238d11a: Round-trip environment variables whose keys are not POSIX shell identifiers (e.g. OTP URIs keyed by email) when running flows locally, instead of failing or dropping them.
- 51e8fc3: Wire `flows run --timeout` into the web flow expect timeout. Previously the flag only set Playwright's per-action timeout, so assertion failures still waited the hardcoded 30s default; it now applies to actions and assertions alike.

## 1.0.0

### Major Changes

- 9b946e0: Initial public release of the QA Wolf CLI — run QA Wolf flows from your terminal or CI.

  Highlights:
  - `qawolf auth login` — authenticate with QA Wolf (or set `QAWOLF_API_KEY` in CI)
  - `qawolf flows run --env <env-id>` — pull and run your team's flows locally
  - `qawolf flows pull` — refresh the local flow cache
  - `qawolf run create --environment-id <env-id>` — trigger a run of your flows on the QA Wolf platform
  - `qawolf install` — install runtime dependencies (browsers, Android tooling)
  - `qawolf init` — scaffold a local-only project
  - `qawolf doctor` — diagnose setup problems

  Install with `npm install -g @qawolf/cli` (Node 22+), try it with `npx @qawolf/cli --help`, or download a standalone binary for Linux, macOS, or Windows from GitHub Releases. Full documentation at [docs.qawolf.com](https://docs.qawolf.com).

### Minor Changes

- 61fa3f6: Add a contract-driven public API command layer: every contract published in
  `@qawolf/api-contracts` automatically becomes a `qawolf <namespace>
<action>` command, starting with `qawolf run create`.
- 03817c8: Add the `qawolf-cli` Agent Skill (`skills/qawolf-cli/SKILL.md`): lean, task-first guidance for coding agents — auth, output modes, read/write safety, and a command index that delegates flag reference to `qawolf <command> --help`. The `skills/` directory ships in the npm package.

### Patch Changes

- d7ea923: Agent mode (`--agent`) now emits structured results as JSON on stdout (human-readable progress stays on stderr).
- 5905699: Exit with code 3 (auth) instead of 1 when the API key is missing or invalid, and clean up `--help` output: remove an internal note from the `--trace` flag description and give the `run` command group a curated description.
- 9cbd6c2: Harden tar extraction in `flows pull` to reject archive entries with an unknown size, and restore flow-discovery and runner logging in `flows run --env` mode.
