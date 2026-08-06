import type { Command } from "commander";
import { knownJournalStreams } from "@qawolf/api-contracts/v1";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { makeInteractiveRunnerDeps } from "~/domains/interactiveRunner/deps.js";
import { handleRunnerEvents } from "~/domains/interactiveRunner/events.js";
import { handleRunnerLaunch } from "~/domains/interactiveRunner/launch.js";
import { handleRunnerRun } from "~/domains/interactiveRunner/runFlow.js";
import { handleRunnerStop } from "~/domains/interactiveRunner/stop.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

const runnerFlagDescription =
  "Runner to target. Defaults to QAWOLF_RUNNER_ID, then this directory's stored runner";

const launchExamples = `
Examples:
  $ qawolf runner launch
  $ qawolf runner launch --name node20WithAndroid
  $ qawolf runner launch --id ci`;

const runExamples = `
Examples:
  $ qawolf runner run flows/checkout.flow.ts
  $ qawolf runner run flows/checkout.flow.ts --follow`;

const eventsExamples = `
Examples:
  $ qawolf runner events recorder --tail 5
  $ qawolf runner events run-logs --run <runId> --follow
  $ qawolf runner events console --since 120 --json`;

function deps(
  ctx: AuthCommandContext,
): ReturnType<typeof makeInteractiveRunnerDeps> {
  return makeInteractiveRunnerDeps({
    cwd: process.cwd(),
    env: process.env,
    fs: ctx.fs,
  });
}

export function registerRunnerCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const runner = program
    .command("runner")
    .description("Drive an interactive runner on the QA Wolf platform");

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

  declareCommandKind(runner.command("stop"), "write")
    .description("Stop an interactive runner")
    .option("--runner <id>", runnerFlagDescription)
    .action((opts: { runner?: string }, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerStop(ctx, { runner: opts.runner }, deps(ctx)),
      )(opts, command),
    );

  declareCommandKind(runner.command("run <file>"), "write")
    .description(
      "Run a flow on an interactive runner, shipping the current directory's files with it",
    )
    .option("--follow", "Stream the run's logs until it settles", false)
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", runExamples)
    .action(
      (
        file: string,
        opts: { follow: boolean; runner?: string },
        command: Command,
      ) =>
        withAuthContext(signals, (ctx) =>
          handleRunnerRun(
            ctx,
            { entryPoint: file, follow: opts.follow, runner: opts.runner },
            deps(ctx),
          ),
        )(opts, command),
    );

  declareCommandKind(runner.command("events <stream>"), "read")
    .description(
      `Print a runner's journal, one entry per line. QA Wolf writes ${knownJournalStreams.join(", ")}`,
    )
    .option("--follow", "Keep reading as new entries arrive", false)
    .option("--run <id>", "Restrict run-scoped streams to one run")
    .option("--runner <id>", runnerFlagDescription)
    .option("--since <sequence>", "Read entries after this sequence")
    .option("--tail <count>", "Read only the newest <count> entries")
    .addHelpText("after", eventsExamples)
    .action((stream: string, opts: EventsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerEvents(
          ctx,
          {
            // --json is a global flag, so it is read from the parsed globals
            // rather than declared here. It selects the full envelope, which is
            // what a caller paging or correlating entries needs; the payload
            // alone is what a caller reading them wants.
            envelope: Boolean(
              command.optsWithGlobals<{ json?: boolean }>().json,
            ),
            follow: opts.follow,
            run: opts.run,
            runner: opts.runner,
            since: opts.since,
            stream,
            tail: opts.tail,
          },
          deps(ctx),
        ),
      )(opts, command),
    );
}

type EventsFlags = {
  follow: boolean;
  run?: string;
  runner?: string;
  since?: string;
  tail?: string;
};
