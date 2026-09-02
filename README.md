# QA Wolf CLI

[![npm version](https://img.shields.io/npm/v/@qawolf/cli)](https://www.npmjs.com/package/@qawolf/cli)
[![CI](https://github.com/qawolf/cli/actions/workflows/ci.yml/badge.svg)](https://github.com/qawolf/cli/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Run QA Wolf flows from your terminal or in CI.

The CLI runs and manages flows locally. Flow creation, AI-powered test generation, managed cloud execution, and team collaboration are part of the full QA Wolf platform. See [docs.qawolf.com](https://docs.qawolf.com) for the full docs, or [qawolf.com](https://www.qawolf.com) to get started.

## Install

```bash
npm install -g @qawolf/cli
# or: pnpm add -g @qawolf/cli
# or: yarn global add @qawolf/cli
# or: bun add -g @qawolf/cli
```

Try it without installing:

```bash
npx @qawolf/cli --help
```

Supported Node versions: Node 20.19+. Node 20 reached [end-of-life](https://endoflife.date/nodejs) on 2026-04-30 and no longer receives security updates; it remains supported here only for environments still pinned to Node 20. Prefer Node 22+ where possible.

### Standalone binaries

Precompiled binaries are attached to each [GitHub Release](https://github.com/qawolf/cli/releases) — no Node.js required: `qawolf-linux-x64`, `qawolf-linux-arm64`, `qawolf-darwin-x64`, `qawolf-darwin-arm64`, and `qawolf-windows-x64.exe`.

```bash
curl -fsSL -o qawolf https://github.com/qawolf/cli/releases/latest/download/qawolf-darwin-arm64
chmod +x qawolf && ./qawolf --help
```

## Quick start

You need a QA Wolf account — sign up at [qawolf.com](https://www.qawolf.com). The `<env-id>` comes from the QA Wolf dashboard under **Settings → Environments**.

```bash
qawolf auth login                  # or set QAWOLF_API_KEY for CI
qawolf flows run --env <env-id>
```

`qawolf flows run --env` runs your team's flows from the local `.qawolf/<env>` cache (a per-environment copy of your flows on disk), pulling them first only if they are not already cached locally and installing the runtime dependencies they need. To refresh the local cache, run `qawolf flows pull --env <env-id>`; to author flows locally without the platform, run `qawolf init` first.

## Examples

The [`examples/`](examples) directory contains sample flows you can run directly:

```bash
qawolf install   # one-time: install the browser runtime
qawolf flows run examples/example.flow.ts
```

## Commands

| Command          | What it does                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qawolf auth`    | [Authenticate with QA Wolf](https://docs.qawolf.com/qawolf/local-execution/authenticate)                                                                       |
| `qawolf flows`   | [Run flows locally](https://docs.qawolf.com/qawolf/local-execution/run-flows-locally), [pull flows](https://docs.qawolf.com/qawolf/local-execution/pull-flows) |
| `qawolf run`     | Trigger and manage QA Wolf runs on the platform (public API)                                                                                                   |
| `qawolf install` | [Install runtime dependencies](https://docs.qawolf.com/qawolf/local-execution/install-dependencies)                                                            |
| `qawolf init`    | [Set up a local-only project](https://docs.qawolf.com/qawolf/local-execution/set-up-a-project)                                                                 |
| `qawolf doctor`  | [Diagnose problems](https://docs.qawolf.com/qawolf/local-execution/diagnose-problems)                                                                          |

Run any command with `--help` for its flags and options.

## Agent integration

This repository ships a [`qawolf-cli` Agent Skill](skills/qawolf-cli/SKILL.md) that follows the open [Agent Skills specification](https://agentskills.io/specification). It works with compatible harnesses such as Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, and OpenCode.

Install the CLI first, then use the cross-harness [`skills`](https://github.com/vercel-labs/skills) installer to install the skill globally:

```bash
npm install -g @qawolf/cli
npx skills add qawolf/cli --skill qawolf-cli --global
```

The installer detects supported harnesses and prompts you to select where to install the skill. To target specific harnesses non-interactively:

```bash
npx skills add qawolf/cli \
  --skill qawolf-cli \
  --global \
  --agent claude-code \
  --agent codex \
  --yes
```

Omit `--global` to install the skill only for the current project. The skill also ships in the npm package for consumers that manage skill files directly.

The skill is generated from its [source template](src/commands/qawolfCliSkill.template.md) and the command tree (`bun run generate`), and kept in sync by the test suite.

## Runner SDK

Drive interactive runners from TypeScript instead of spawning commands. Every verb names the runner it addresses, so nothing is launched or billed implicitly.

```ts
import { createRunnerSdk } from "@qawolf/cli/runner-sdk";

const runner = createRunnerSdk({ apiKey: process.env.QAWOLF_API_KEY });

await runner.launch({ id: "agent-1", runnerFamily: "default" });

const submitted = await runner.run({
  entryPointPath: "src/flows/smoke.flow.ts",
  environment: "ambient",
  runnerId: "agent-1",
  selection: "whole-flow",
});
if (submitted.ok) console.log(submitted.value.runId, submitted.value.fileSync);
```

`ok: false` is a transport or auth failure. A runner that refused the request comes back as `ok: true` with `value.outcome === "failure"` and a `failureReason` from the published contract, so a caller can switch on it exhaustively.

## Reference

- [Commands](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/commands) — full command and flag reference
- [Configuration](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/configuration) — `qawolf.config.ts` fields
- [Environment variables](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/environment-variables)
- [Exit codes](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/index#exit-codes)
- [Troubleshooting](https://docs.qawolf.com/qawolf/libraries/cli/troubleshooting)
- [Known issues](docs/known-issues.md) — current limitations and workarounds

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup. To report a bug or request a feature, open an issue on [GitHub](https://github.com/qawolf/cli/issues).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
