import { join } from "node:path";
import envPaths from "env-paths";
import type { CommandContext } from "~/shell/commandContext.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { installMessages } from "~/core/messages/index.js";
import { appiumUiautomator2DriverVersion } from "~/generated/dependencyVersions.js";

export type InstallDriverDeps = {
  readonly spawn: SpawnFn;
  readonly envDir: string;
  readonly platform: NodeJS.Platform;
};

// Must match the APPIUM_HOME used by createAppiumServer so that drivers
// installed here are found when the server starts during flows run.
const appiumEnv = {
  APPIUM_HOME: join(envPaths("qawolf").data, "appium"),
};

export async function installUiautomator2Driver(
  ctx: CommandContext,
  deps: InstallDriverDeps,
): Promise<void> {
  const appiumBinPath = resolveAppiumBin(deps.envDir, deps.platform);

  // Check whether the driver is already installed before attempting install.
  const listResult = await deps.spawn(
    appiumBinPath,
    ["driver", "list", "--installed"],
    { env: appiumEnv, platform: deps.platform },
  );
  // Appium writes driver list output to stderr on some versions.
  if ((listResult.stdout + listResult.stderr).includes("uiautomator2")) {
    ctx.ui.info(installMessages.android.uiautomator2AlreadyInstalled);
    return;
  }

  ctx.ui.step(installMessages.android.installingUiautomator2);
  const installResult = await deps.spawn(
    appiumBinPath,
    ["driver", "install", `uiautomator2@${appiumUiautomator2DriverVersion}`],
    { env: appiumEnv, platform: deps.platform },
  );
  if (installResult.exitCode !== 0) {
    const output = installResult.stderr + installResult.stdout;
    // Treat "already installed" as success — can happen when the list check
    // missed the driver due to output format differences.
    if (output.includes("already installed")) {
      ctx.ui.info(installMessages.android.uiautomator2AlreadyInstalled);
      return;
    }
    const detail =
      output
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) ?? `exit code ${installResult.exitCode}`;
    throw new Error(installMessages.android.uiautomator2InstallFailed(detail));
  }
}
