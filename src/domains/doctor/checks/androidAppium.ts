import { doctorMessages } from "~/core/messages/index.js";
import { appiumCliCandidates } from "~/core/nodeModulesBins.js";
import { getAppiumHome } from "~/core/paths.js";
import type { CheckResult } from "~/domains/doctor/types.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

function firstLine(result: SpawnResult): string {
  return (
    (result.stderr || result.stdout).split("\n")[0]?.trim() ||
    `exit code ${result.exitCode}`
  );
}

export function checkAppium(
  envDir: string | undefined,
  platform: NodeJS.Platform,
  checkExists: (path: string) => boolean,
): { appium: CheckResult; bin: string | undefined } {
  const candidates = envDir ? appiumCliCandidates(envDir, platform) : [];
  const bin = candidates.find(checkExists);
  if (!bin) {
    return {
      appium: {
        name: "appium",
        status: "warn",
        detail: doctorMessages.appium.notFound(candidates[0]),
      },
      bin: undefined,
    };
  }
  return { appium: { name: "appium", status: "pass" }, bin };
}

export async function checkUiautomator2(
  spawn: SpawnFn,
  appiumBin: string | undefined,
  platform: NodeJS.Platform,
): Promise<CheckResult> {
  if (!appiumBin) {
    return {
      name: "uiautomator2-driver",
      status: "warn",
      detail: doctorMessages.appium.cannotCheckDriverList,
    };
  }
  const result = await spawn(appiumBin, ["driver", "list", "--installed"], {
    env: { APPIUM_HOME: getAppiumHome() },
    platform,
  });
  if (result.exitCode !== 0) {
    return {
      name: "uiautomator2-driver",
      status: "warn",
      detail: doctorMessages.appium.driverListFailed(firstLine(result)),
    };
  }
  // Appium 2 prints the driver list to stderr on some versions.
  const output = result.stdout + result.stderr;
  if (output.includes("uiautomator2")) {
    return { name: "uiautomator2-driver", status: "pass" };
  }
  return {
    name: "uiautomator2-driver",
    status: "warn",
    detail: doctorMessages.appium.uiautomator2NotInstalled,
  };
}
