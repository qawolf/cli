import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { collectValue, parseInteger } from "~/domains/runner/runFlagParsers.js";

import { addRunArtifactOptions } from "./runArtifactOptions.js";
import { makeFlowsRunAction } from "./runAction.js";

const runExamples = `
Examples:
  $ qawolf flows run
  $ qawolf flows run "flows/checkout/**"
  $ qawolf flows run --retries 2 --video retain-on-failure
  $ qawolf flows run --tag auth
  $ qawolf flows run --tag auth --env staging
  $ qawolf flows run checkout --env staging --headed`;

export function registerFlowsRunCommand(
  flows: Command,
  signals: SignalRegistry,
): void {
  const command = declareCommandKind(flows.command("run [pattern]"), "local", {
    kindNote: "read with --env",
  })
    .description(
      "Run flows matching [pattern], or every flow when omitted; with --env, pull missing flows from that QA Wolf environment",
    )
    .option(
      "--retries <n>",
      "Retry each failing flow up to this many times",
      parseInteger("--retries", { min: 0 }),
      0,
    )
    .option("--bail", "Stop the run after the first failure", false)
    .option(
      "--workers <n>",
      "Parallel worker count for web flows",
      parseInteger("--workers", { min: 1 }),
      1,
    )
    .option(
      "--timeout <ms>",
      "Default timeout for actions and assertions, in milliseconds",
      parseInteger("--timeout", { min: 0 }),
      30_000,
    );

  addRunArtifactOptions(command)
    .option("--headed", "Show the browser window instead of headless", false)
    .option(
      "--env <env>",
      "Pull and run a flow from this environment (UUID or slug) if not cached locally",
    )
    .option(
      "--deps <dir>",
      "Use this prepared dependency directory instead of auto-installing the runtime; or set QAWOLF_RUNTIME_DIR to relocate the managed runtime",
    )
    .option(
      "--allow-no-match",
      "Exit 0 instead of 2 when the pattern selects no runnable flow",
      false,
    )
    .option(
      "--no-browser-deps",
      "Skip installing OS-level browser dependencies (Linux --with-deps, which needs root); requires the system libraries to already be present",
    )
    .option(
      "--tag <name>",
      "Only run flows carrying this tag; repeat for several. Without --env, matches against tags cached by the last pull",
      collectValue,
      [],
    )
    .option(
      "--all-envs",
      "When a tag matches flows in several pulled environments, run every match instead of choosing one",
      false,
    )
    .addHelpText("after", runExamples)
    .action(makeFlowsRunAction(signals));
}
