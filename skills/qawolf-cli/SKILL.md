---
name: qawolf-cli
description: Run QA Wolf flows and trigger runs through the QA Wolf public API using the qawolf CLI. Use when asked to run, list, pull, or create QA Wolf tests/runs from a shell.
---

# QA Wolf CLI

`qawolf` runs QA Wolf flows locally and calls the QA Wolf public API.

This file is an overview, not a reference. Before using any command, run
`qawolf <command> --help` — the installed CLI is authoritative for flags and
always matches its version.

## Auth

Commands that talk to QA Wolf authenticate via the `QAWOLF_API_KEY`
environment variable (or stored credentials from `qawolf auth login`).
Verify with `qawolf auth whoami`. Never print or log the key.

## Output

When consuming output programmatically, always pass `--json` (or `--agent`).
Human-formatted output is not stable across versions. Errors go to stderr;
a non-zero exit code means the command failed.

## Safety: reads vs writes

Read commands are safe to run and retry freely. Write commands act on the
real team — confirm intent before running them, and never blind-retry a
write on timeout: it may have reached the server the first time.

## Commands

| Command              | Kind  | What it does                                                                                                                          |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `qawolf run create`  | write | Create a run of selected flows in an environment. Starts a real run that consumes team resources.                                     |
| `qawolf flows run`   | local | Run flows from the local project on this machine.                                                                                     |
| `qawolf flows list`  | read  | List flows, local or remote (`--remote`).                                                                                             |
| `qawolf flows pull`  | read  | Download an environment's flows into the local cache.                                                                                 |
| `qawolf auth login`  | local | Store QA Wolf credentials.                                                                                                            |
| `qawolf auth logout` | local | Remove stored credentials.                                                                                                            |
| `qawolf auth whoami` | read  | Show authentication status.                                                                                                           |
| `qawolf init`        | local | Scaffold a QA Wolf project in the current directory.                                                                                  |
| `qawolf install`     | local | Install runtime dependencies the project's flows need (`qawolf install browsers` and `qawolf install android` for one platform only). |
| `qawolf doctor`      | local | Diagnose problems running flows locally.                                                                                              |

Kinds: `read` calls the QA Wolf API without changing anything; `write`
changes team state; `local` only affects this machine.

## Typical tasks

- Trigger a run of flows on QA Wolf: `qawolf run create --help` for the
  required flags, then run it once and report the returned run id.
- Run flows locally during development: `qawolf flows run` (use
  `qawolf install` first if dependencies are missing; `qawolf doctor` when
  something is broken).
- Get flows for an environment: `qawolf flows pull`.
