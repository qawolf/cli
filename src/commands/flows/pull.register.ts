import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { flowsMessages } from "~/core/messages/index.js";
import {
  type FlowsPullOptions,
  handleFlowsPull,
} from "~/domains/flows/pull/handler.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

const pullExamples = `
Examples:
  $ qawolf flows pull --env staging
  $ qawolf flows pull --env 4e9c... --out ./snapshot
  $ qawolf flows pull --env staging --yes`;

type FlowsPullCliOptions = Omit<FlowsPullOptions, "env"> & {
  readonly env: string | undefined;
};

export function registerFlowsPullCommand(
  flows: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(flows.command("pull"), "read")
    .description(
      "Download an environment's flows into the local .qawolf/<env>/ cache",
    )
    .option(
      "--env <env>",
      "Environment to pull from (UUID or kebab-case slug); defaults to QAWOLF_ENVIRONMENT, or an interactive picker",
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
    .action((opts: FlowsPullCliOptions, command: Command) => {
      return withResolvedEnv(
        signals,
        { explicit: opts.env, requiredMessage: flowsMessages.pull.requiresEnv },
        (ctx, env, identity) =>
          handleFlowsPull(ctx, {
            ...opts,
            env,
            envSlug: identity.slug,
            envName: identity.name,
          }),
      )(opts, command);
    });
}
