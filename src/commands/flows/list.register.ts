import { Option, type Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import { flowsMessages } from "~/core/messages/index.js";
import { handleFlowsList } from "~/domains/flows/listDefaults.js";
import { flowsListRemote } from "~/domains/flows/listRemote.js";
import { collectValue } from "~/domains/runner/runFlagParsers.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import {
  terminalListView,
  unavailableTerminalList,
} from "./terminalListView.js";
import type { withResolvedEnv } from "./withResolvedEnv.js";

const listExamples = `
Examples:
  $ qawolf flows list
  $ qawolf flows list --no-interactive
  $ qawolf flows list "flows/checkout/**"
  $ qawolf flows list --remote --env staging
  $ qawolf flows list --tag auth
  $ qawolf flows list --env staging --tag auth
  $ qawolf flows list --remote --env staging --tag auth --tag smoke
  $ qawolf flows list "**/checkout/**" --remote --env staging --include-drafts
  $ qawolf flows list --remote --env staging --ai-task-id ait_123`;

type FlowsListOptions = {
  readonly remote: boolean;
  readonly env: string | undefined;
  readonly includeDrafts: boolean;
  readonly aiTaskId: string | undefined;
  readonly tag: string[];
  // Undefined unless -i or --no-interactive was passed; the terminal decides.
  readonly interactive: boolean | undefined;
};

export type ListCommandDeps = {
  readonly withResolvedEnv: typeof withResolvedEnv;
};

export function registerFlowsListCommand(
  flows: Command,
  signals: SignalRegistry,
  deps: ListCommandDeps,
): void {
  declareCommandKind(flows.command("list [pattern]"), "local", {
    kindNote: "read with --remote",
  })
    .description(
      "List flows matching [pattern] from the local project, or from a QA Wolf environment with --remote",
    )
    .option(
      "--remote",
      "List flows from the QA Wolf platform instead of the local project",
      false,
    )
    .option(
      "--env <env>",
      "Environment to list flows from: a QA Wolf environment with --remote, otherwise a pulled one by slug or id",
    )
    .option(
      "--include-drafts",
      "Include draft flows in the listing (requires --remote)",
      false,
    )
    .option(
      "--tag <name>",
      "Only list flows carrying this tag; repeat for several. Without --remote, matches against tags cached by the last pull",
      collectValue,
      [],
    )
    // Declared before --no-interactive, so neither passed leaves it undefined.
    .option(
      "-i, --interactive",
      "Open the flow table to filter as you type, mark flows and copy their paths or ids; the default at a terminal",
    )
    .option("--no-interactive", "Print the flow table instead of opening it")
    .addOption(
      new Option(
        "--ai-task-id <aiTaskId>",
        "List the flows on this AI task's branch, including drafts, instead of the ones in the environment (requires --remote)",
      ).env("QAWOLF_AI_TASK_ID"),
    )
    .addHelpText("after", listExamples)
    .action(
      (
        pattern: string | undefined,
        opts: FlowsListOptions,
        command: Command,
      ) => {
        const unavailable = unavailableTerminalList(opts.interactive, command);
        if (unavailable !== undefined) {
          return withContext(signals, async () => unavailable)(opts, command);
        }
        const tags = opts.tag;
        if (opts.remote) {
          return deps.withResolvedEnv(
            signals,
            {
              explicit: opts.env,
              requiredMessage: flowsMessages.list.remoteRequiresEnv,
            },
            (ctx, env) =>
              flowsListRemote(
                ctx,
                pattern,
                {
                  env,
                  includeDrafts: opts.includeDrafts,
                  aiTaskId: opts.aiTaskId,
                  tags,
                },
                terminalListView(opts.interactive, ctx),
              ),
          )(opts, command);
        }
        // An inherited env-var default must not prevent a local listing.
        if (command.getOptionValueSource("aiTaskId") === "cli") {
          return withContext(signals, async () => ({
            error: flowsMessages.list.aiTaskIdRequiresRemote,
          }))(opts, command);
        }
        if (opts.includeDrafts) {
          return withContext(signals, async () => ({
            error: flowsMessages.list.draftsRequireRemote,
          }))(opts, command);
        }
        // Without --remote the tags come from the pull cache, so this works
        // offline; it cannot validate names against the team's tag list.
        return withContext(signals, (ctx) =>
          handleFlowsList(
            ctx,
            pattern,
            { tags, env: opts.env },
            terminalListView(opts.interactive, ctx),
          ),
        )(opts, command);
      },
    );
}
