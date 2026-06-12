---
"@qawolf/cli": major
---

Initial public release of the QA Wolf CLI — run QA Wolf flows from your terminal or CI.

Highlights:

- `qawolf auth login` — authenticate with QA Wolf (or set `QAWOLF_API_KEY` in CI)
- `qawolf flows run --env <env-id>` — pull and run your team's flows locally
- `qawolf flows pull` — refresh the local flow cache
- `qawolf run create --environment-id <env-id>` — trigger a run of your flows on the QA Wolf platform
- `qawolf install` — install runtime dependencies (browsers, Android tooling)
- `qawolf init` — scaffold a local-only project
- `qawolf doctor` — diagnose setup problems

Install with `npm install -g @qawolf/cli` (Node 22+), try it with `npx @qawolf/cli --help`, or download a standalone binary for Linux, macOS, or Windows from GitHub Releases. Full documentation at [docs.qawolf.com](https://docs.qawolf.com).
