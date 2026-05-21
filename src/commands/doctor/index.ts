import type { Command } from "commander";

import { withContext } from "~/commands/context.js";

import { handleDoctor } from "./handler.js";

type DoctorOpts = { readonly all?: boolean };

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run environment diagnostics")
    .option(
      "--all",
      "Run all platform checks (Android, etc.) regardless of project content",
    )
    .action((opts: DoctorOpts, command: Command) => {
      return withContext((ctx) =>
        handleDoctor(ctx, { all: opts.all ?? false }),
      )(opts, command);
    });
}
