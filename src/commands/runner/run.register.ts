import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { defaultFollowTimeoutSeconds } from "~/core/interactiveRunner/followTimeout.js";
import { handleRunnerRun } from "~/domains/interactiveRunner/runFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const runExamples = `
Examples:
  $ qawolf runner run flows/checkout.flow.ts
  $ qawolf runner run flows/checkout.flow.ts --follow
  $ qawolf runner run flows/checkout.flow.ts --follow --logs
  $ qawolf runner run flows/checkout.flow.ts --lines 12-40
  $ qawolf runner run flows/checkout.flow.ts --lines 4-9 --lines-file pages/login.ts`;

type RunFlags = {
  follow: boolean;
  lines?: string;
  linesFile?: string;
  logs: boolean;
  recorderEvents: boolean;
  runEvents: boolean;
  runner?: string;
  timeout: string;
};

export function registerRunCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("run <flowFile>"), "write")
    .description(
      "Run a flow on an interactive runner, shipping the current directory's files with it",
    )
    .option(
      "--follow",
      "Report the run's status until it settles: in progress, then passed or failed",
      false,
    )
    // Not --verbose: the program already claims that flag for debug logging,
    // and Commander lets a program-level option swallow it from any position.
    .option(
      "--logs",
      "Stream every log line the run produces while following. Implies --follow",
      false,
    )
    .option(
      "--run-events",
      "Stream the run's progress events as JSON lines while following. Implies --follow",
      false,
    )
    .option(
      "--recorder-events",
      "Stream the browser actions the runner records as JSON lines while following, from an anchor taken just before submission: the recorder is runner-wide, not run-scoped. Implies --follow",
      false,
    )
    .option(
      "--lines <start-end>",
      "Run only these 1-indexed lines against the browser as it stands, instead of the whole flow from a fresh one",
    )
    .option(
      "--lines-file <path>",
      "File the --lines range lives in. Defaults to <flowFile>; pass it only when the lines are in another file, such as a page object",
    )
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--timeout <seconds>",
      "Give up following after this long. Following keeps the runner alive, so a run that never settles would otherwise bill until the terminal closed",
      String(defaultFollowTimeoutSeconds),
    )
    .addHelpText("after", runExamples)
    .action((flowFile: string, opts: RunFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRun(
          ctx,
          {
            entryPoint: flowFile,
            follow: opts.follow,
            lines: opts.lines,
            linesFile: opts.linesFile,
            logs: opts.logs,
            recorderEvents: opts.recorderEvents,
            runEvents: opts.runEvents,
            runner: opts.runner,
            timeout: opts.timeout,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
