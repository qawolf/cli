import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import { makeDefaultInitDeps, handleInit } from "~/domains/init/init.js";

type InitFlags = {
  yes: boolean;
};

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scaffold a new QA Wolf project")
    .option("--yes", "Skip overwrite prompts", false)
    .action((opts: InitFlags, command: Command) => {
      return withContext((ctx) => handleInit(ctx, opts, makeDefaultInitDeps()))(
        opts,
        command,
      );
    });
}
