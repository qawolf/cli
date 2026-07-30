import { join } from "node:path";

import envPaths from "env-paths";

import { doctorMessages } from "~/core/messages/index.js";
import type { CheckResult } from "~/domains/doctor/types.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

function firstLine(result: SpawnResult): string {
  return (
    (result.stderr || result.stdout).split("\n")[0]?.trim() ||
    `exit code ${result.exitCode}`
  );
}

// Must match the APPIUM_HOME used by createAppiumServer and install android,
// so the driver registry doctor inspects is the same one install populates.
const appiumHome = join(envPaths("qawolf").data, "appium");

export function checkAppium(
  envDir: string | undefined,
  resolveAppiumBin: (envDir: string) => string,
  checkExists: (path: string) => boolean,
): { appium: CheckResult; bin: string | undefined } {
  if (!envDir) {
    return {
      appium: {
        name: "appium",
        status: "warn",
        detail: doctorMessages.appium.noEnvDir,
      },
      bin: undefined,
    };
  }
  const bin = resolveAppiumBin(envDir);
  if (!checkExists(bin)) {
    return {
      appium: {
        name: "appium",
        status: "warn",
        detail: doctorMessages.appium.binaryMissing(bin),
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
    env: { APPIUM_HOME: appiumHome },
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
