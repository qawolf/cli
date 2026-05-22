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
    .description("Run environment diagnostics")
    .option(
      "--all",
      "Run all platform checks (Android, etc.) regardless of project content",
    )
    .action((opts: DoctorOpts, command: Command) => {
      return withContext(signals, (ctx) =>
        handleDoctor(ctx, { all: opts.all ?? false }),
      )(opts, command);
    });
}
