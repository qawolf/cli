import type { Command } from "commander";
import { knownJournalStreams } from "@qawolf/api-contracts/v1";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { defaultFollowTimeoutSeconds } from "~/core/interactiveRunner/followTimeout.js";
import { handleRunnerEvents } from "~/domains/interactiveRunner/events.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { deps, runnerFlagDescription } from "./shared.js";

const eventsExamples = `
Examples:
  $ qawolf runner events recorder --tail 5
  $ qawolf runner events run-logs --run <runId> --follow
  $ qawolf runner events console --since 120 --json`;

type EventsFlags = {
  follow: boolean;
  run?: string;
  runner?: string;
  since?: string;
  tail?: string;
  timeout: string;
};

export function registerEventsCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
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
          deps(ctx),
        ),
      )(opts, command),
    );
}
