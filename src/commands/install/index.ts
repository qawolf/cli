import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withContext } from "~/commands/context.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { handleInstallAndroid } from "./android.js";
import { handleInstall } from "./all.js";
import { handleInstallBrowsers } from "./browsers.js";
import { mergedBrowserDeps } from "./browserDepsFlag.js";
import { handleInstallClear } from "./clear.js";

const noBrowserDepsDescription =
  "Skip installing OS-level browser dependencies (Linux --with-deps, which needs root); requires the system libraries to already be present";

export function registerInstallCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const install = declareCommandKind(program.command("install"), "local")
    .description("Install every runtime dependency the project's flows need")
    .argument(
      "[pattern]",
      "Glob limiting which flows determine required dependencies",
    )
    .option("--no-browser-deps", noBrowserDepsDescription)
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install
  $ qawolf install "flows/checkout/**"`,
    )
    .action(
      (
        pattern: string | undefined,
        opts: { browserDeps: boolean },
        command: Command,
      ) => {
        return withContext(signals, (ctx) =>
          handleInstall(ctx, pattern, { browserDeps: opts.browserDeps }),
        )(opts, command);
      },
    );

  declareCommandKind(install.command("browsers [pattern]"), "local")
    .description("Install Playwright browsers used by the project's web flows")
    .option("--no-browser-deps", noBrowserDepsDescription)
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install browsers
  $ qawolf install browsers "flows/web/**"`,
    )
    .action(
      (
        pattern: string | undefined,
        opts: { browserDeps: boolean },
        command: Command,
      ) => {
        return withContext(signals, (ctx) =>
          handleInstallBrowsers(ctx, pattern, {
            envDir: undefined,
            browserDeps: mergedBrowserDeps(opts.browserDeps, command),
          }),
        )(opts, command);
      },
    );

  declareCommandKind(install.command("android [pattern]"), "local")
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

  declareCommandKind(install.command("clear"), "local")
    .description(
      "Remove the managed runtime cache (all installed runtime versions)",
    )
    .option("--yes", "Skip the confirmation prompt", false)
    .addHelpText(
      "after",
      `
Examples:
  $ qawolf install clear
  $ qawolf install clear --yes`,
    )
    .action((opts: { yes?: boolean }, command: Command) => {
      return withContext(signals, (ctx) =>
        handleInstallClear(ctx, { yes: opts.yes ?? false }),
      )(opts, command);
    });
}
