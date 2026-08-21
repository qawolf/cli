import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerKeepalive } from "~/domains/interactiveRunner/keepalive.js";
import { handleRunnerLaunch } from "~/domains/interactiveRunner/launch.js";
import { handleRunnerTerminate } from "~/domains/interactiveRunner/terminate.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const launchExamples = `
Examples:
  $ qawolf runner launch
  $ qawolf runner launch --name android
  $ qawolf runner launch --id ci`;

const keepaliveExamples = `
Examples:
  $ qawolf runner keepalive
  $ qawolf runner keepalive --runner ci`;

export function registerRunnerLifecycleCommands(
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
    .option("--name <family>", "Runner family to run, e.g. playwright")
    .addHelpText("after", launchExamples)
    .action((opts: { id?: string; name?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerLaunch(
          ctx,
          { id: opts.id, name: opts.name },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );

  declareCommandKind(runner.command("terminate"), "write")
    .description("End an interactive runner, and the pod it runs on with it")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerTerminate(ctx, { runner: opts.runner }, runnerDeps(ctx)),
      )(opts, command),
    );

  declareCommandKind(runner.command("keepalive"), "read")
    .description(
      "Reset a runner's inactivity clock, for a caller that pauses between actions",
    )
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", keepaliveExamples)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerKeepalive(ctx, { runner: opts.runner }, runnerDeps(ctx)),
      )(opts, command),
    );
}
