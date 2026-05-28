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
    .description("Install every runtime dependency the project's flows need")
    .argument(
      "[pattern]",
      "Glob limiting which flows determine required dependencies",
    )
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install
  $ qawolf install "flows/checkout/**"`,
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleInstall(ctx, pattern))(
        opts,
        command,
      );
    });

  install
    .command("browsers [pattern]")
    .description("Install Playwright browsers used by the project's web flows")
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install browsers
  $ qawolf install browsers "flows/web/**"`,
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
      "Install Android system images, AVDs, and the Appium driver used by the project's Android flows",
    )
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install android
  $ qawolf install android "flows/mobile/**"`,
    )
    .action((pattern: string | undefined, opts: unknown, command: Command) => {
      return withContext(signals, (ctx) => handleInstallAndroid(ctx, pattern))(
        opts,
        command,
      );
    });
}
