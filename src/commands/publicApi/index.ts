import { Option, type Command } from "commander";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { withAuthContext } from "~/commands/context.js";
import {
  buildCommandSpecs,
  type CommandSpec,
  type ContractTree,
} from "~/domains/publicApi/commandSpecs.js";
import { handlePublicApiCommand } from "~/domains/publicApi/handle.js";
import { declareCommandKind } from "~/commands/commandKind.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

type AuthDeps = Parameters<typeof withAuthContext>[2];

type Options = {
  // Defaults to the published contract tree; tests inject custom trees.
  contracts?: ContractTree;
  // Threaded through withAuthContext so tests can fake auth and the client.
  authDeps?: AuthDeps;
};

// Curated descriptions for generated command groups so top-level --help reads
// like the hand-written entries; unlisted namespaces fall back to a generic line.
const groupDescriptions: Record<string, string> = {
  run: "Trigger and manage QA Wolf runs on the platform",
};

// Contracts already served by hand-written commands; the generator must not
// mint duplicates (flow.list is served by `qawolf flows list --remote`).
const handWrittenContractNames: ReadonlySet<string> = new Set(["flow.list"]);

// Kept out of generated commands: the hand-written ones above, plus contracts
// whose input can't be expressed as CLI flags (issue.update is a
// discriminator-less union).
const skippedContractNames: ReadonlySet<string> = new Set([
  ...handWrittenContractNames,
  "issue.update",
]);

const optionEnvironmentVariables = new Map([
  ["public.run.create.aiTaskId", "QAWOLF_AI_TASK_ID"],
]);

function resolveGroup(parent: Command, segment: string): Command {
  const existing = parent.commands.find(
    (command) => command.name() === segment,
  );
  return (
    existing ??
    parent
      .command(segment)
      .description(
        groupDescriptions[segment] ?? `QA Wolf public API ${segment} commands`,
      )
  );
}

function registerSpec(
  program: Command,
  signals: SignalRegistry,
  spec: CommandSpec,
  authDeps: AuthDeps | undefined,
): void {
  const groupPath = spec.commandPath.slice(0, -1);
  const leafName = spec.commandPath[spec.commandPath.length - 1];
  if (leafName === undefined) {
    throw new Error(`Contract "${spec.trpcPath}" has an empty command path.`);
  }

  const parent = groupPath.reduce(resolveGroup, program);
  if (parent.commands.some((command) => command.name() === leafName)) {
    throw new Error(
      `Generated command "${spec.commandPath.join(
        " ",
      )}" collides with an existing command.`,
    );
  }

  const command = declareCommandKind(
    parent.command(leafName),
    spec.kind,
  ).description(spec.description);
  for (const flag of spec.flags) {
    const environmentVariable = optionEnvironmentVariables.get(
      `${spec.trpcPath}.${flag.field}`,
    );
    if (environmentVariable) {
      const option = new Option(flag.flag, flag.description).env(
        environmentVariable,
      );
      if (flag.required) option.makeOptionMandatory();
      command.addOption(option);
    } else if (flag.required) {
      command.requiredOption(flag.flag, flag.description);
    } else {
      command.option(flag.flag, flag.description);
    }
  }

  command.action((options: Record<string, unknown>, leaf: Command) =>
    withAuthContext(
      signals,
      (ctx) => handlePublicApiCommand(ctx, spec, options),
      authDeps ?? {},
    )(options, leaf),
  );
}

// Registers one CLI command per public API contract. Adding a contract to
// @qawolf/api-contracts and updating the dependency is all it takes for a
// new `qawolf <namespace> <action>` command to exist.
export function registerPublicApiCommands(
  program: Command,
  signals: SignalRegistry,
  options: Options = {},
): void {
  const specs = buildCommandSpecs(options.contracts ?? publicContractsV1, {
    skipContractNames: skippedContractNames,
  });
  for (const spec of specs) {
    registerSpec(program, signals, spec, options.authDeps);
  }
}
