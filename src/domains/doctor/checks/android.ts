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
};

export async function checkAndroid(
  deps: CheckAndroidDeps,
): Promise<CheckResult[]> {
  const home = checkHome(deps.androidHome, deps.checkExists);
  const [adb, emulator, avds] = await Promise.all([
    checkAdb(deps.spawn, deps.androidHome),
    checkEmulatorBin(deps.spawn, deps.androidHome),
    checkAvds(deps.spawn, deps.androidHome, deps.requiredAvds),
  ]);
  const { appium, bin } = checkAppium(
    deps.envDir,
    deps.resolveAppiumBin,
    deps.checkExists,
  );
  const uiautomator2 = await checkUiautomator2(deps.spawn, bin);
  return [home, adb, emulator, ...avds, appium, uiautomator2];
}
