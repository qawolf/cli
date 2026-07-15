import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext, withContext } from "~/commands/context.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleFlowsList } from "~/domains/flows/list.js";
import { flowsListRemote } from "~/domains/flows/listRemote.js";
import {
  type FlowsPullOptions,
  handleFlowsPull,
} from "~/domains/flows/pull/handler.js";
import { registerFlowsRunCommand } from "./run.register.js";
import { registerRunWorkerCommand } from "./runWorker.register.js";

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

const pullExamples = `
Examples:
  $ qawolf flows pull --env staging
  $ qawolf flows pull --env 4e9c... --out ./snapshot
  $ qawolf flows pull --env staging --yes`;

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
      "Environment to list flows from (required with --remote)",
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
          const env = opts.env;
          if (env === undefined) {
            return withContext(signals, async () => ({
              error: flowsMessages.list.remoteRequiresEnv,
            }))(opts, command);
          }
          return withAuthContext(signals, (ctx) =>
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

  declareCommandKind(flows.command("pull"), "read")
    .description(
      "Download an environment's flows into the local .qawolf/<env>/ cache",
    )
    .requiredOption(
      "--env <env>",
      "Environment to pull from (UUID or kebab-case slug)",
    )
    .option(
      "--out <path>",
      "Destination directory (defaults to .qawolf/<env>/)",
    )
    .option(
      "--yes",
      "Overwrite locally-modified files without prompting",
      false,
    )
    .addHelpText("after", pullExamples)
    .action((opts: FlowsPullOptions, command: Command) => {
      return withAuthContext(signals, (ctx) => handleFlowsPull(ctx, opts))(
        opts,
        command,
      );
    });
}
