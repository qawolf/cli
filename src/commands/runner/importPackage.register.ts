import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleRunnerImportPackage } from "~/domains/interactiveRunner/importPackage.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { runnerDeps, runnerFlagDescription } from "./context.js";

const importPackageExamples = `
Examples:
  $ qawolf runner import-package dayjs
  $ qawolf runner import-package dayjs --package-version 1.11.13`;

export function registerRunnerImportPackageCommand(
  runner: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(runner.command("import-package <name>"), "write")
    .description(
      "Install a package into a runner's live run, so a snippet or a selection can import it",
    )
    .option("--package-version <version>", "Version to install", "latest")
    .option("--runner <id>", runnerFlagDescription)
    .addHelpText("after", importPackageExamples)
    .action(
      (
        name: string,
        opts: { packageVersion: string; runner?: string },
        command: Command,
      ) =>
        withAuthContext(signals, (ctx) =>
          handleRunnerImportPackage(
            ctx,
            { name, runner: opts.runner, version: opts.packageVersion },
            runnerDeps(ctx),
          ),
        )(opts, command),
    );
}
