import type { Command } from "commander";

import { withContext } from "~/commands/context.js";

import { handleInstallBrowsers } from "./browsers.js";

export function registerInstallCommand(program: Command): void {
  const install = program
    .command("install")
    .description("Install runtime dependencies for QA Wolf flows");

  install
    .command("browsers [pattern]")
    .description(
      "Install Playwright browsers required by the project's web flows",
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext((ctx) => handleInstallBrowsers(ctx, pattern))(
        opts,
        command,
      );
    });
}
