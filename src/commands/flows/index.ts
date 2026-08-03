import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleFlowsList } from "~/domains/flows/list.js";
import { flowsListRemote } from "~/domains/flows/listRemote.js";
import { registerFlowsPullCommand } from "./pull.register.js";
import { registerFlowsRunCommand } from "./run.register.js";
import { registerRunWorkerCommand } from "./runWorker.register.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

const listExamples = `
Examples:
  $ qawolf flows list
  $ qawolf flows list "flows/checkout/**"
  $ qawolf flows list --remote --env staging
  $ qawolf flows list "**/checkout/**" --remote --env staging --include-drafts`;

type FlowsListOptions = {
  readonly remote: boolean;
  readonly env: string | undefined;
  readonly includeDrafts: boolean;
};

export function registerFlowsCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const flows = program
    .command("flows")
    .description("Manage and run QA Wolf flows");

  registerFlowsRunCommand(flows, signals);
  registerRunWorkerCommand(flows, signals);

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
      "Environment to list flows from (with --remote; defaults to QAWOLF_ENVIRONMENT, or an interactive picker)",
    )
    .option(
      "--include-drafts",
      "Include draft flows in the listing (requires --remote)",
      false,
    )
    .addHelpText("after", listExamples)
    .action(
      (
        pattern: string | undefined,
        opts: FlowsListOptions,
        command: Command,
      ) => {
        if (opts.remote) {
          return withResolvedEnv(
            signals,
            {
              explicit: opts.env,
              requiredMessage: flowsMessages.list.remoteRequiresEnv,
            },
            (ctx, env) =>
              flowsListRemote(ctx, pattern, {
                env,
                includeDrafts: opts.includeDrafts,
              }),
          )(opts, command);
        }
        if (opts.env !== undefined || opts.includeDrafts) {
          return withContext(signals, async () => ({
            error: flowsMessages.list.flagsRequireRemote,
          }))(opts, command);
        }
        return withContext(signals, (ctx) => handleFlowsList(ctx, pattern))(
          opts,
          command,
        );
      },
    );

  registerFlowsPullCommand(flows, signals);
}
