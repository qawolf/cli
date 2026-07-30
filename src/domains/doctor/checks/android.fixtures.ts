import { mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import type { checkAndroid } from "./android.js";

export const sdk = "/sdk";
export const adbPath = `${sdk}/platform-tools/adb`;
export const emulatorPath = `${sdk}/emulator/emulator`;
export const envDir = "/proj";
export const appiumBin = `${envDir}/node_modules/.bin/appium`;

export const success: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };
export const launchFail: SpawnResult = {
  exitCode: -1,
  stdout: "",
  stderr: "",
};

export function spawnRouter(
  routes: Record<string, SpawnResult>,
  fallback: SpawnResult = success,
): SpawnFn {
  return mock<SpawnFn>((cmd) => Promise.resolve(routes[cmd] ?? fallback));
}

export function baseDeps(
  over: Partial<Parameters<typeof checkAndroid>[0]> = {},
) {
  return {
    spawn: spawnRouter({}),
    androidHome: sdk,
    checkExists: mock<(path: string) => boolean>(() => true),
    envDir,
    resolveAppiumBin: (dir: string) => `${dir}/node_modules/.bin/appium`,
    requiredAvds: [] as readonly string[],
    platform: "linux" as NodeJS.Platform,
    ...over,
  };
}

export function findResult(
  results: Awaited<ReturnType<typeof checkAndroid>>,
  name: string,
) {
  return results.find((r) => r.name === name);
}
