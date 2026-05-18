import { join } from "node:path";
import envPaths from "env-paths";
import type { CommandContext } from "~/shell/commandContext.js";
import type { SpawnFn } from "~/shell/spawn.js";
import { appiumUiautomator2DriverVersion } from "~/generated/dependencyVersions.js";

export type InstallDriverDeps = {
  readonly spawn: SpawnFn;
  readonly appiumBinPath: string;
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
  // Check whether the driver is already installed before attempting install.
  const listResult = await deps.spawn(
    deps.appiumBinPath,
    ["driver", "list", "--installed"],
    { env: appiumEnv },
  );
  // Appium writes driver list output to stderr on some versions.
  if ((listResult.stdout + listResult.stderr).includes("uiautomator2")) {
    ctx.ui.info("uiautomator2 driver already installed.");
    return;
  }

  ctx.ui.step("Installing uiautomator2 driver");
  const installResult = await deps.spawn(
    deps.appiumBinPath,
    ["driver", "install", `uiautomator2@${appiumUiautomator2DriverVersion}`],
    { env: appiumEnv },
  );
  if (installResult.exitCode !== 0) {
    const output = installResult.stderr + installResult.stdout;
    // Treat "already installed" as success — can happen when the list check
    // missed the driver due to output format differences.
    if (output.includes("already installed")) {
      ctx.ui.info("uiautomator2 driver already installed.");
      return;
    }
    const detail =
      output
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean) ?? `exit code ${installResult.exitCode}`;
    throw new Error(`appium driver install uiautomator2 failed: ${detail}`);
  }
}
