# @qawolf/cli

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
