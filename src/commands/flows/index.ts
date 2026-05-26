import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleFlowsList } from "~/domains/flows/list.js";
import {
  type FlowsPullOptions,
  handleFlowsPull,
} from "~/domains/flows/pull/handler.js";
import { registerFlowsRunCommand } from "./run.register.js";

const listExamples = `
Examples:
  $ qawolf flows list
  $ qawolf flows list "flows/checkout/**"`;

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

  flows
    .command("list [pattern]")
    .description(
      "List flow files in the project, optionally filtered by [pattern]",
    )
    .addHelpText("after", listExamples)
    .action((pattern: string | undefined, opts: unknown, command: Command) =>
      withContext(signals, (ctx) => handleFlowsList(ctx, pattern))(
        opts,
        command,
      ),
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
