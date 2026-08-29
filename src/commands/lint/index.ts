import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleLint } from "./handler.js";

export function registerLintCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(program.command("lint"), "local")
    .description(
      "Lint flow files with QA Wolf's rules, honoring the project's .eslintrc.json",
    )
    .argument("<files...>", "Files to lint")
    .addHelpText(
      "after",
      `
Exits 1 when a file has a lint error, and 0 when every file is clean or only
has warnings.

Examples:
  $ qawolf lint flows/login.flow.ts
  $ qawolf lint flows/login.flow.ts flows/checkout.flow.ts`,
    )
    .action((files: string[], opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleLint(ctx, { files }))(
        opts,
        command,
      );
    });
}
