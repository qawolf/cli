import type { Command } from "commander";

import { withContext } from "~/commands/context.js";

import { handleDoctor } from "./handler.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run environment diagnostics")
    .action(withContext(handleDoctor));
}
