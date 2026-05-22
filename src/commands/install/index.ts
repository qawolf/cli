import type { Command } from "commander";

import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleInstallAndroid } from "./android.js";
import { handleInstall } from "./all.js";
import { handleInstallBrowsers } from "./browsers.js";

export function registerInstallCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const install = program
    .command("install")
    .description("Install runtime dependencies for QA Wolf flows")
    .argument("[pattern]", "Glob pattern to filter flow files")
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleInstall(ctx, pattern))(
        opts,
        command,
      );
    });

  install
    .command("browsers [pattern]")
    .description(
      "Install Playwright browsers required by the project's web flows",
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleInstallBrowsers(ctx, pattern))(
        opts,
        command,
      );
    });

  install
    .command("android [pattern]")
    .description(
      "Install Android system images, AVDs, and Appium driver for the project's Android flows",
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleInstallAndroid(ctx, pattern))(
        opts,
        command,
      );
    });
}
