import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { defaultFollowTimeoutSeconds } from "~/core/interactiveRunner/followTimeout.js";
import { handleRunnerRun } from "~/domains/interactiveRunner/runFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { deps, runnerFlagDescription } from "./shared.js";

const runExamples = `
Examples:
  $ qawolf runner run flows/checkout.flow.ts
  $ qawolf runner run flows/checkout.flow.ts --follow`;

type RunFlags = { follow: boolean; runner?: string; timeout: string };

export function registerRunCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("run <file>"), "write")
    .description(
      "Run a flow on an interactive runner, shipping the current directory's files with it",
    )
    .option("--follow", "Stream the run's logs until it settles", false)
    .option("--runner <id>", runnerFlagDescription)
    .option(
      "--timeout <seconds>",
      "Give up following after this long. Following keeps the runner alive, so a run that never settles would otherwise bill until the terminal closed",
      String(defaultFollowTimeoutSeconds),
    )
    .addHelpText("after", runExamples)
    .action((file: string, opts: RunFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerRun(
          ctx,
          {
            entryPoint: file,
            follow: opts.follow,
            runner: opts.runner,
            timeout: opts.timeout,
          },
          deps(ctx),
        ),
      )(opts, command),
    );
}
