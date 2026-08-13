import type { Command } from "commander";
import { knownJournalStreams } from "@qawolf/api-contracts/v1";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { defaultFollowTimeoutSeconds } from "~/core/interactiveRunner/followTimeout.js";
import { handleRunnerEvents } from "~/domains/interactiveRunner/events.js";
import { handleRunnerRun } from "~/domains/interactiveRunner/runFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const runExamples = `
Examples:
  $ qawolf runner run flows/checkout.flow.ts
  $ qawolf runner run flows/checkout.flow.ts --follow
  $ qawolf runner run flows/checkout.flow.ts --follow --logs`;

const eventsExamples = `
Examples:
  $ qawolf runner events recorder --tail 5
  $ qawolf runner events run-logs --run <runId> --follow
  $ qawolf runner events console --since 120 --json`;

type RunFlags = {
  follow: boolean;
  logs: boolean;
  recorderEvents: boolean;
  runEvents: boolean;
  runner?: string;
  timeout: string;
};

type EventsFlags = {
  follow: boolean;
  run?: string;
  runner?: string;
  since?: string;
  tail?: string;
  timeout: string;
};

export function registerRunnerRunCommands(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("run <file>"), "write")
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
      "Stream the browser actions the runner records as JSON lines while following, from submission on: the recorder is runner-wide, not run-scoped. Implies --follow",
      false,
    )
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

  declareCommandKind(runner.command("events <stream>"), "read")
    .description(
      `Print a runner's journal, one entry per line. QA Wolf writes ${knownJournalStreams.join(", ")}`,
    )
    .option(
      "--follow",
      "Keep reading as new entries arrive. Reading counts as activity, so a follow left open keeps the runner alive and billing",
      false,
    )
    .option("--run <id>", "Restrict run-scoped streams to one run")
    .option("--runner <id>", runnerFlagDescription)
    .option("--since <sequence>", "Read entries after this sequence")
    .option("--tail <count>", "Read only the newest <count> entries")
    .option(
      "--timeout <seconds>",
      "Give up following after this long. Reading keeps the runner alive, so a follow left open would otherwise bill until the terminal closed",
      String(defaultFollowTimeoutSeconds),
    )
    .addHelpText("after", eventsExamples)
    .action((stream: string, opts: EventsFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleRunnerEvents(
          ctx,
          {
            // --json is a global flag, so it is read from the parsed globals
            // rather than declared here.
            envelope: Boolean(
              command.optsWithGlobals<{ json?: boolean }>().json,
            ),
            follow: opts.follow,
            run: opts.run,
            runner: opts.runner,
            since: opts.since,
            stream,
            tail: opts.tail,
            timeout: opts.timeout,
          },
          runnerDeps(ctx),
        ),
      )(opts, command),
    );
}
