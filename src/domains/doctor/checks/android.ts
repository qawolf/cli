import type { CheckResult } from "~/domains/doctor/types.js";
import type { SpawnFn } from "~/shell/spawn.js";

import { checkAppium, checkUiautomator2 } from "./androidAppium.js";
import {
  checkAdb,
  checkAvds,
  checkEmulatorBin,
  checkHome,
} from "./androidSdk.js";

export type CheckAndroidDeps = {
  readonly spawn: SpawnFn;
  readonly androidHome: string | undefined;
  readonly checkExists: (path: string) => boolean;
  readonly envDir: string | undefined;
  readonly resolveAppiumBin: (envDir: string) => string;
  readonly requiredAvds: readonly string[];
  readonly platform: NodeJS.Platform;
};

export async function checkAndroid(
  deps: CheckAndroidDeps,
): Promise<CheckResult[]> {
  const home = checkHome(deps.androidHome, deps.checkExists);
  const [adb, emulator, avds] = await Promise.all([
    checkAdb(deps.spawn, deps.androidHome, deps.platform),
    checkEmulatorBin(deps.spawn, deps.androidHome, deps.platform),
    checkAvds(deps.spawn, deps.androidHome, deps.requiredAvds, deps.platform),
  ]);
  const { appium, bin } = checkAppium(
    deps.envDir,
    deps.resolveAppiumBin,
    deps.checkExists,
  );
  const uiautomator2 = await checkUiautomator2(deps.spawn, bin, deps.platform);
  return [home, adb, emulator, ...avds, appium, uiautomator2];
}
