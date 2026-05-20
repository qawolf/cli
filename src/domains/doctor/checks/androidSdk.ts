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
      detail:
        "ANDROID_HOME (or ANDROID_SDK_ROOT) is not set. Install Android Studio and set ANDROID_HOME to the SDK path.",
    };
  }
  if (!checkExists(androidHome)) {
    return {
      name: "android-home",
      status: "fail",
      detail: `${androidHome} does not exist`,
    };
  }
  return { name: "android-home", status: "pass", detail: androidHome };
}

export async function checkAdb(
  spawn: SpawnFn,
  androidHome: string | undefined,
): Promise<CheckResult> {
  const bin = androidHome ? `${androidHome}/platform-tools/adb` : "adb";
  const result = await spawn(bin, ["--version"]);
  if (result.exitCode < 0) {
    return {
      name: "adb",
      status: "fail",
      detail: `adb not found at ${bin}. Install Android SDK platform-tools.`,
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
): Promise<CheckResult> {
  const bin = androidHome ? `${androidHome}/emulator/emulator` : "emulator";
  const result = await spawn(bin, ["-version"]);
  if (result.exitCode < 0) {
    return {
      name: "android-emulator",
      status: "fail",
      detail: `emulator not found at ${bin}. Install the Android SDK emulator package.`,
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
): Promise<CheckResult[]> {
  if (requiredAvds.length === 0) return [];
  const bin = androidHome ? `${androidHome}/emulator/emulator` : "emulator";
  const result = await spawn(bin, ["-list-avds"]);
  if (result.exitCode !== 0) {
    return [
      {
        name: "android-avd",
        status: "warn",
        detail: `Could not list AVDs (${firstLine(result)})`,
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
      detail: `Missing AVD(s): ${missing.join(", ")}. Run \`qawolf install android\`.`,
    },
  ];
}
