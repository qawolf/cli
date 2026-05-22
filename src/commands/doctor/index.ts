import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleDoctor } from "./handler.js";

type DoctorOpts = { readonly all?: boolean };

export function registerDoctorCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  program
    .command("doctor")
    .description("Diagnose problems running flows locally")
    .option(
      "--all",
      "Run every platform check, including platforms the project does not use",
      false,
    )
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf doctor
  $ qawolf doctor --all`,
    )
    .action((opts: DoctorOpts, command: Command) => {
      return withContext(signals, (ctx) =>
        handleDoctor(ctx, { all: opts.all ?? false }),
      )(opts, command);
    });
}
