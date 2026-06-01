# QA Wolf CLI

Run QA Wolf flows from your terminal or in CI.

The CLI runs and manages flows locally. Flow creation, AI-powered test generation, managed cloud execution, and team collaboration are part of the full QA Wolf platform. See [docs.qawolf.com](https://docs.qawolf.com) for the full docs, or [qawolf.com](https://www.qawolf.com) to get started.

## Install

```bash
npm install -g @qawolf/cli
```

Requires Node.js 24 or later. Precompiled binaries for Linux, macOS, and Windows are also published on [GitHub Releases](https://github.com/qawolf/cli/releases).

## Quick start

```bash
qawolf auth login                  # or set QAWOLF_API_KEY for CI
qawolf flows run --env <env-id>
```

`qawolf flows run --env` runs your team's flows from the local `.qawolf/<env>` cache, pulling them first only if they are not already cached locally, then installs the runtime dependencies they need and runs them. To refresh the local cache, run `qawolf flows pull --env <env-id>`. To author flows locally without the platform, run `qawolf init` first.

## Commands

| Command          | What it does                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qawolf auth`    | [Authenticate with QA Wolf](https://docs.qawolf.com/qawolf/local-execution/authenticate)                                                                       |
| `qawolf flows`   | [Run flows locally](https://docs.qawolf.com/qawolf/local-execution/run-flows-locally), [pull flows](https://docs.qawolf.com/qawolf/local-execution/pull-flows) |
| `qawolf install` | [Install runtime dependencies](https://docs.qawolf.com/qawolf/local-execution/install-dependencies)                                                            |
| `qawolf init`    | [Set up a local-only project](https://docs.qawolf.com/qawolf/local-execution/set-up-a-project)                                                                 |
| `qawolf doctor`  | [Diagnose problems](https://docs.qawolf.com/qawolf/local-execution/diagnose-problems)                                                                          |

Run any command with `--help` for its flags and options.

## Reference

- [Commands](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/commands) — full command and flag reference
- [Configuration](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/configuration) — `qawolf.config.ts` fields
- [Environment variables](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/environment-variables)
- [Exit codes](https://docs.qawolf.com/qawolf/libraries/cli/api-reference/index#exit-codes)
- [Troubleshooting](https://docs.qawolf.com/qawolf/libraries/cli/troubleshooting)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup. To report a bug or request a feature, open an issue on [GitHub](https://github.com/qawolf/cli/issues).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
