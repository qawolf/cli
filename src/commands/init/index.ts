import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { makeDefaultInitDeps, handleInit } from "~/domains/init/init.js";

type InitFlags = {
  yes: boolean;
};

export function registerInitCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  program
    .command("init")
    .description("Scaffold a QA Wolf project in the current directory")
    .option("--yes", "Overwrite existing files without prompting", false)
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf init
  $ qawolf init --yes`,
    )
    .action((opts: InitFlags, command: Command) => {
      return withContext(signals, (ctx) =>
        handleInit(ctx, opts, makeDefaultInitDeps()),
      )(opts, command);
    });
}
