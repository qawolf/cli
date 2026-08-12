import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerLaunch } from "~/domains/interactiveRunner/launch.js";
import { handleRunnerStop } from "~/domains/interactiveRunner/stop.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { deps, runnerFlagDescription } from "./shared.js";

const launchExamples = `
Examples:
  $ qawolf runner launch
  $ qawolf runner launch --name node20WithAndroid
  $ qawolf runner launch --id ci`;

export function registerLaunchCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("launch"), "write")
    .description(
      "Launch an interactive runner and make it this directory's default",
    )
    .option(
      "--id <id>",
      "Id to launch under. Relaunching an id attaches to that runner",
    )
    .option("--name <image>", "Runner image to run, e.g. node20WithPlaywright")
    .addHelpText("after", launchExamples)
    .action((opts: { id?: string; name?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerLaunch(ctx, { id: opts.id, name: opts.name }, deps(ctx)),
      )(opts, command),
    );
}

export function registerStopCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("stop"), "write")
    .description("Stop an interactive runner")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerStop(ctx, { runner: opts.runner }, deps(ctx)),
      )(opts, command),
    );
}
