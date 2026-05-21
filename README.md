# QA Wolf CLI

Run QA Wolf flows from your terminal or in CI.

The CLI is for running and managing flows locally. Flow creation, AI-powered test generation, managed cloud execution, and team collaboration are part of the full QA Wolf platform. See [docs.qawolf.com](https://docs.qawolf.com) for the full docs, or [qawolf.com](https://www.qawolf.com) to get started.

## Installation

```bash
npm install -g @qawolf/cli
```

## Quickstart

**1. Log in**

```bash
qawolf auth login
```

**2. Pull flows from your environment**

```bash
qawolf flows pull --env <env-id>
```

Your environment ID and API key are in your workspace settings on the QA Wolf platform. The `--env` flag accepts either the full UUID or the kebab-case slug.

**3. Run**

```bash
qawolf flows run
```

Run `qawolf flows run --help` for the full list of flags (retries, timeouts, artifact capture, and more).

## Platform requirements

The CLI runs on any platform that supports Playwright or Appium. Some flow types have additional requirements:

| Flow type | Additional requirement                                      |
| --------- | ----------------------------------------------------------- |
| Web       | None                                                        |
| Android   | Android SDK with ADB (`ANDROID_HOME` or `ANDROID_SDK_ROOT`) |
| iOS       | macOS with Xcode                                            |

The CLI will ensure Playwright is installed automatically, so you do not need Playwright installed separately.

## Authentication

For interactive use, `qawolf auth login` prompts for your API key and stores it locally.

For CI and non-interactive environments, set the environment variable directly instead:

```bash
export QAWOLF_API_KEY=your-api-key
```

Your API key is in your workspace settings on the QA Wolf platform.

## Environments

An environment in QA Wolf groups a set of flows and their configuration. Use `flows pull` to download flows from a specific environment:

```bash
qawolf flows pull --env <env-id>
```

Your environment IDs are in workspace settings on the QA Wolf platform.

## Running in CI

Commit your pulled flows to the repository, add `QAWOLF_API_KEY` as a repository secret, then use this workflow:

```yaml
name: QA Wolf
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Install QA Wolf CLI
        run: npm install -g @qawolf/cli
      - name: Install browsers
        run: qawolf install browsers
      - name: Run flows
        run: qawolf flows run
        env:
          QAWOLF_API_KEY: ${{ secrets.QAWOLF_API_KEY }}
```

Exit code `0` means all flows passed; `1` means one or more failed. See `qawolf flows run --help` for retry, timeout, and artifact options.

## Troubleshooting

If flows are not running as expected, start with:

```bash
qawolf doctor
```

This checks your Node.js version, Playwright installation, browser availability, and Android SDK configuration. Pass `--all` to run every platform check regardless of which flow types are in the project.

## Known limitations

- **iOS flows require macOS** — Xcode and iOS simulators are macOS-only.
- **Parallel workers not yet supported** — `--workers` is accepted but capped at 1 in v0.1.
- **File assets not pulled** — `flows pull` does not download file attachments in v0.1.
- **Mobile flows require a local APK or IPA path** — set the path via an environment variable in your flow config.
- **`--har` captures headers and timing only by default** — use `--har-content full` for response bodies (increases memory usage).
- **Dynamic `target` flows** — flows with a runtime-resolved target cannot be pre-flight-detected and are included in all runs.
- **`Basic` target flows** — pull correctly but cannot be executed with the CLI in v0.1.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup. To report a bug or request a feature, open an issue on [GitHub](https://github.com/qawolf/cli/issues).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
