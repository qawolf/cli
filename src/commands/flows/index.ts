import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
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
  $ qawolf flows list --remote
  $ qawolf flows list "**/checkout/**" --remote`;

type FlowsListOptions = { readonly remote: boolean };

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

  flows
    .command("list [pattern]")
    .description(
      "List flows matching [pattern] from the local project, or from QA Wolf with --remote",
    )
    .option(
      "--remote",
      "List flows from the QA Wolf platform instead of the local project",
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
          return withAuthContext(signals, (ctx) =>
            flowsListRemote(ctx, pattern),
          )(opts, command);
        }
        return withContext(signals, (ctx) => handleFlowsList(ctx, pattern))(
          opts,
          command,
        );
      },
    );

  flows
    .command("pull")
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
