import { join } from "node:path";

import envPaths from "env-paths";

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
        detail:
          "No env dir found. Run `qawolf flows run` to install Appium dependencies.",
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
        detail: `Appium binary missing at ${bin}. Run \`qawolf flows run\` to install.`,
      },
      bin: undefined,
    };
  }
  return { appium: { name: "appium", status: "pass" }, bin };
}

export async function checkUiautomator2(
  spawn: SpawnFn,
  appiumBin: string | undefined,
): Promise<CheckResult> {
  if (!appiumBin) {
    return {
      name: "uiautomator2-driver",
      status: "warn",
      detail: "Cannot check driver list without Appium binary.",
    };
  }
  const result = await spawn(appiumBin, ["driver", "list", "--installed"], {
    env: { APPIUM_HOME: appiumHome },
  });
  if (result.exitCode !== 0) {
    return {
      name: "uiautomator2-driver",
      status: "warn",
      detail: `Could not run \`appium driver list\` (${firstLine(result)}). The Appium binary may be broken — try \`qawolf flows run\` to reinstall.`,
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
    detail:
      "uiautomator2 driver not installed. Run `qawolf install android` to install it.",
  };
}
