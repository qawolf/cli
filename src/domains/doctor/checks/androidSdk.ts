import { adbBin, emulatorBin } from "~/core/androidBins.js";
import { doctorMessages } from "~/core/messages/index.js";
import type { CheckResult } from "~/domains/doctor/types.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

function firstLine(result: SpawnResult): string {
  return (
    (result.stderr || result.stdout).split("\n")[0]?.trim() ||
    `exit code ${result.exitCode}`
  );
}

export function checkHome(
  androidHome: string | undefined,
  checkExists: (path: string) => boolean,
): CheckResult {
  if (!androidHome) {
    return {
      name: "android-home",
      status: "fail",
      detail: doctorMessages.androidSdk.homeNotSet,
    };
  }
  if (!checkExists(androidHome)) {
    return {
      name: "android-home",
      status: "fail",
      detail: doctorMessages.androidSdk.homeDoesNotExist(androidHome),
    };
  }
  return { name: "android-home", status: "pass", detail: androidHome };
}

export async function checkAdb(
  spawn: SpawnFn,
  androidHome: string | undefined,
  platform: NodeJS.Platform,
): Promise<CheckResult> {
  const bin = adbBin(androidHome, platform);
  const result = await spawn(bin, ["--version"]);
  if (result.exitCode < 0) {
    return {
      name: "adb",
      status: "fail",
      detail: doctorMessages.androidSdk.adbLaunchFailed(bin, firstLine(result)),
    };
  }
  if (result.exitCode !== 0) {
    return { name: "adb", status: "fail", detail: firstLine(result) };
  }
  return { name: "adb", status: "pass" };
}

export async function checkEmulatorBin(
  spawn: SpawnFn,
  androidHome: string | undefined,
  platform: NodeJS.Platform,
): Promise<CheckResult> {
  const bin = emulatorBin(androidHome, platform);
  const result = await spawn(bin, ["-version"]);
  if (result.exitCode < 0) {
    return {
      name: "android-emulator",
      status: "fail",
      detail: doctorMessages.androidSdk.emulatorLaunchFailed(
        bin,
        firstLine(result),
      ),
    };
  }
  if (result.exitCode !== 0) {
    return {
      name: "android-emulator",
      status: "fail",
      detail: firstLine(result),
    };
  }
  return { name: "android-emulator", status: "pass" };
}

export async function checkAvds(
  spawn: SpawnFn,
  androidHome: string | undefined,
  requiredAvds: readonly string[],
  platform: NodeJS.Platform,
): Promise<CheckResult[]> {
  if (requiredAvds.length === 0) return [];
  const bin = emulatorBin(androidHome, platform);
  const result = await spawn(bin, ["-list-avds"]);
  if (result.exitCode < 0) {
    return [
      {
        name: "android-avd",
        status: "warn",
        detail: doctorMessages.androidSdk.emulatorAvdListFailed(
          bin,
          firstLine(result),
        ),
      },
    ];
  }
  if (result.exitCode !== 0) {
    return [
      {
        name: "android-avd",
        status: "warn",
        detail: doctorMessages.androidSdk.avdListFailed(firstLine(result)),
      },
    ];
  }
  const installed = new Set(
    result.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const missing = requiredAvds.filter((a) => !installed.has(a));
  if (missing.length === 0) return [];
  return [
    {
      name: "android-avd",
      status: "warn",
      detail: doctorMessages.androidSdk.missingAvds(missing.join(", ")),
    },
  ];
}
