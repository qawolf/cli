import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import { flowsMessages } from "~/core/messages/index.js";
import { collectValue } from "~/domains/runner/runFlagParsers.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleFlowsList } from "~/domains/flows/listDefaults.js";
import { flowsListRemote } from "~/domains/flows/listRemote.js";
import { registerFlowsLintCommand } from "./lint.register.js";
import { registerFlowsPullCommand } from "./pull.register.js";
import { registerFlowsRunCommand } from "./run.register.js";
import { registerRunWorkerCommand } from "./runWorker.register.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

const listExamples = `
Examples:
  $ qawolf flows list
  $ qawolf flows list "flows/checkout/**"
  $ qawolf flows list --remote --env staging
  $ qawolf flows list --tag auth
  $ qawolf flows list --env staging --tag auth
  $ qawolf flows list --remote --env staging --tag auth --tag smoke
  $ qawolf flows list "**/checkout/**" --remote --env staging --include-drafts`;

type FlowsListOptions = {
  readonly remote: boolean;
  readonly env: string | undefined;
  readonly includeDrafts: boolean;
  readonly tag: string[];
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
    .addHelpText("after", listExamples)
    .action(
      (
        pattern: string | undefined,
        opts: FlowsListOptions,
        command: Command,
      ) => {
        const tags = opts.tag;
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
                tags,
              }),
          )(opts, command);
        }
        // --include-drafts is a platform concept; --env is not, so without
        // --remote it names a pulled environment and is answered from disk.
        if (opts.includeDrafts) {
          return withContext(signals, async () => ({
            error: flowsMessages.list.draftsRequireRemote,
          }))(opts, command);
        }
        // Without --remote the tags come from the pull cache, so this works
        // offline; it cannot validate names against the team's tag list.
        return withContext(signals, (ctx) =>
          handleFlowsList(ctx, pattern, { tags, env: opts.env }),
        )(opts, command);
      },
    );

  registerFlowsLintCommand(flows, signals);
  registerFlowsPullCommand(flows, signals);
}
