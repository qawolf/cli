# @qawolf/cli

## 1.7.3

### Patch Changes

- 1f57b57: Align browser install and doctor with the pinned playwright runtime. The CLI shipped an unused `@playwright/test` dependency, and user projects can install their own copy at any version. Both packages declare a `playwright` bin, and either can win the `node_modules/.bin/playwright` shim. When the shim belongs to a different version than the pinned `playwright`, `install browsers` downloads browser builds for the wrong playwright version. The flow runtime imports the `playwright` module, so it could not launch the installed builds. This change removes the `@playwright/test` dependency. `install browsers`, `doctor`, and runtime-dir validation now run the `playwright` package's own `cli.js` through the CLI's runtime, so the installed builds always match the runtime. `doctor` now also fails with a clear message when the installed playwright version differs from the pinned runtime version.
- 563dbd7: Make `init` repair an existing package.json so the scaffolded flow can load. The scaffolded flow and config are ES modules. Node reads their module format from the nearest package.json `type` field. Before this change, `init` only added the `test:e2e` script to an existing package.json. It did not set `"type": "module"` and did not add the `@qawolf/flows` dependency, so the example flow failed to load. Current npm writes `"type": "commonjs"` into every `npm init -y` package.json, so an explicit value does not signal author intent. `init` now offers three changes in one prompt: add the `test:e2e` script, set `"type": "module"`, and add the `@qawolf/flows` dependency. It applies the missing ones and skips the rest. It prints a warning after it changes an explicit `type` value, because that changes how every `.js` file in the package loads. Run `init` again on a half-configured project to repair it; the old code stopped at the first existing script.
- 163f6aa: Show flow failure detail in json output. Before this change, a failed `flows run` printed only `{"type":"error","title":"N flow(s) failed"}` in json mode. The CLI also selects json mode in CI and when stdout is piped. The failure message and stack only reached disk through the `--junit` report. The final error event now includes a `body` field. The `body` field contains the message and the cause stack for each failed flow. Human and agent modes do not change. They already show the failure detail inline.

## 1.7.2

### Patch Changes

- 7eb3322: Resolve environment aliases before flows commands use them. `flows pull --env <alias>` and `flows run --env <alias>` failed with an HTTP 400 because the CLI sent the alias to an endpoint that requires an environment id. The CLI now resolves an explicit `--env` value, and a `QAWOLF_ENVIRONMENT` value, through the `environment.get` public API. That endpoint accepts an id or an alias and returns the canonical id. Only the id goes to later requests, so `--env <alias>` and `--env <id>` now write to the same `.qawolf/<id>/` cache directory. When the resolution fails, the error names the environment value and tells you that aliases require a team API key.

## 1.7.1

### Patch Changes

- daf62a1: Correct the agent skill to use `QAWOLF_ENVIRONMENT`, matching the environment variable consumed by CLI flow commands.
- 1a4558f: Improve the bundled agent skill with reusable environment selection, result reuse, and safe write guidance, and regenerate command documentation from `@qawolf/api-contracts` 0.22.0.

## 1.7.0

### Minor Changes

- cb5d34e: Upgrade Playwright from 1.58.2 to 1.62.0

### Patch Changes

- 1b2234d: Document cross-harness Agent Skill installation and declare the CLI runtime requirement in the portable skill metadata.

## 1.6.0

### Minor Changes

- e8acd95: `qawolf auth whoami` now works with organization and user API keys, not just team keys. With an organization key it shows the organization; with a user key it shows the signed-in user (email) and their organization. Previously any non-team key failed with "Could not verify API key: unexpected response format".

### Patch Changes

- cb561d7: Teach agents to load the QA Wolf CLI skill for environment-variable and other public API tasks, and document how to use the current environment id.

## 1.5.0

### Minor Changes

- 3bc67bf: `flows pull` and `flows list --remote` no longer require `--env`. When the flag is omitted, the CLI reads `QAWOLF_ENVIRONMENT`, and in an interactive terminal it otherwise lists the team's environments and prompts for a pick — auto-selecting when only one exists. Teams with both static and preview (PR) environments first pick a kind, so ephemeral PR environments don't drown out the static ones. Non-interactive runs without a flag or env var still fail with a clear error, so CI and agent behavior stays deterministic.

  The `@qawolf/api-contracts` bump to 0.14.0 also adds three generated commands: `environment find`, `environment setVariable`, and `flow addTag`.

- 9e1a5c5: The CLI now checks the npm registry for a newer published version while a command runs. After the command completes, the CLI shows an update notice one time for each new version. Human mode shows a styled note. Agent mode writes plain text to stderr. JSON mode writes a note diagnostic to stderr and does not change stdout. Set QAWOLF_NO_UPDATE_CHECK=1 to disable the check.

## 1.4.2

### Patch Changes

- f759778: Fix Windows runs failing with "Could not load @qawolf/testkit ... Received protocol 'c:'". The Node ESM loader requires file:// URLs for absolute paths on win32, so the testkit, Playwright, and emails loaders now convert resolved paths before dynamic import.

## 1.4.1

### Patch Changes

- 5d43046: A request that runs out of time now says it timed out and how long it waited, instead of reporting an unreachable host and sending you to check your network and `QAWOLF_HOST_URL`.

  Behind that, a call can now carry its own deadline rather than sharing one fifteen-second limit with everything else. Nothing changes for calls the platform answers from its database, which is all of them today; the endpoints whose work genuinely takes longer can ask for the time they need.

- ba45b94: Stage flow files correctly on Windows. Flow discovery returned forward-slash paths from the glob, while the rest of the CLI builds paths with `node:path` and gets backslashes. The staging step compared the two, never matched, and returned the original source path. `qawolf flows run` then executed flows from the project tree instead of the prepared run directory, so a flow resolved whatever Playwright the project had installed rather than the pinned executor, and a flow importing `#playwright` failed. Flow discovery now returns one canonical path form.
- e7cf799: Find Playwright and Appium correctly on Windows. The CLI accepted two shim names: the `.cmd` wrapper npm writes, and the extension-less POSIX script. It missed the `.exe` shim `bun install` writes, so `qawolf doctor` reported Playwright as missing, and `qawolf flows run` and `qawolf install browsers` failed on a project installed with bun. It also counted the extension-less script as usable, which Windows cannot launch — `CreateProcess` reports `ENOENT` for a path with no executable extension, even when the file is present. `qawolf doctor` then reported Playwright as installed, and `qawolf flows run` failed with an error naming a file the user can see on disk. Both bugs also gated the pinned-dependency check, so the CLI either reinstalled its runtime on every run or read an unusable directory as fully installed. `appium` carried the same names and the same two bugs, which broke Android flows and `qawolf install android`. The CLI now looks only for the `.cmd` and `.exe` shims on Windows. A project whose `node_modules/.bin` holds only the extension-less shim is now rejected, and the CLI installs its managed runtime instead. That affects a tree installed on Linux or macOS and then used from Windows, through a bind mount, a copied directory, or WSL. A project installed on Windows by npm or bun is unaffected.
- e7cf799: Fix `ENOENT` when the CLI spawns npm, Appium, or the Android SDK tools on Windows. `qawolf flows run` failed while preparing the environment. `qawolf doctor` reported npm and `appium` as not installed, even though both worked in the same shell. `qawolf install android` could not reach `sdkmanager` or `avdmanager`. Windows ships these tools as `.cmd` or `.bat` wrappers and ships no `.exe` alternative. Node's process spawn cannot execute a batch file directly. The CLI now names the wrapper file and runs it through `cmd.exe /d /s /c` with quoted arguments. The `adb` and `emulator` paths built from `ANDROID_HOME` now name the `.exe` suffix directly instead of relying on the spawn path search. Running the CLI inside WSL is unaffected, because it reports itself as Linux and carries POSIX tools.

## 1.4.0

### Minor Changes

- 4a0ac77: Update `@qawolf/api-contracts` to 0.11.0, expanding the generated command surface: `automate`, `environment create|get|listVariableNames`, `issue create|find|get`, `run find|get`, and `tag create` join the existing `run create` and `flows list --remote`.

  Contract inputs expressed as intersections (`run.create`, which now selects flows by id and/or tag) or discriminated unions (`issue.create`, bug vs coverage request) are now mapped to flags: intersection members merge into one flag set, and a union's literal discriminator becomes a required flag (`--type`, documented as "One of: bug, coverageRequest") with branch-specific fields optional. Validation still runs against the real contract schema before any network call, so branch rules and cross-field constraints keep their precise error messages.

- c269262: Add `--no-browser-deps` to `flows run`, `install`, and `install browsers`. On Linux the CLI runs `playwright install --with-deps`, whose OS dependency step shells out to `apt-get` and needs root — on non-root machines without sudo it hangs or fails at a `su` prompt (`playwright install chromium failed: Password:`) even when every system library is already installed. The new flag skips that step and only installs the browsers themselves, so non-root environments with preinstalled system libraries (for example CI images baked with `playwright install-deps`, or a shared `PLAYWRIGHT_BROWSERS_PATH` cache) can run web flows. Default behavior is unchanged; if libraries are missing at launch, Playwright reports the exact packages to install.

## 1.3.2

### Patch Changes

- d55f6ab: Fix `ERR_MODULE_NOT_FOUND: Cannot find package '@qawolf/flows'` when a project dependency (such as `@qawolf/pom`) peer-depends on a pinned runtime package. The per-run install skips peer dependencies (`--legacy-peer-deps`) and the pinned packages were only resolvable from staged flow files, not from installed project dependencies. The outer hop now links every pinned package alongside the installed dependencies, so project packages resolve the same pinned instance the executor uses. Also bumps the pinned `@qawolf/flows` to 0.1.4 and pins its new peer `expect-webdriverio`.
- 7a2f1d1: Record video, HAR, and trace artifacts for browser contexts that flows create themselves via `browser.newContext()` — previously only the context `launch()` returned was recorded, so flows using helpers that build their own context produced empty artifacts. Each context now writes to its own file (`<flow>.har`, `<flow>-2.har`, …).

## 1.3.1

### Patch Changes

- ac2d20d: Allow `QAWOLF_HOST_URL` to target a custom QA Wolf deployment host.

## 1.3.0

### Minor Changes

- 77ba95c: `flows list --remote` is now environment-scoped via the QA Wolf public API: pass `--env <env>` (now required with `--remote`) and optionally `--include-drafts` to include draft flows. JSON output now emits `flowId` instead of `id` for each flow.

### Patch Changes

- db51021: Fix a crash in the exit path when a command fails before the log file opens (a "sonic boom is not ready yet" stack trace printed after the error message). The log fd now opens eagerly at creation while writes stay asynchronous.
- 8f603dd: Skip public-API command generation for contracts served by hand-written commands, so a future `flow.list` contract does not mint a duplicate of `qawolf flows list --remote`.

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
