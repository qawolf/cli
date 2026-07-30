import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { adbBin } from "~/core/androidBins.js";
import type { AdbFn } from "./createAndroidEmulator.js";

const execFileAsync = promisify(execFile);

// Duplicates the private defaultAdb in createAndroidEmulator.ts.
export const defaultAdb: AdbFn = async (args) => {
  const home = process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
  const { stdout } = await execFileAsync(adbBin(home, process.platform), args);
  return { stdout };
};

async function disableAnimations(adb: AdbFn, serial: string): Promise<void> {
  await Promise.all([
    adb([
      "-s",
      serial,
      "shell",
      "settings",
      "put",
      "global",
      "window_animation_scale",
      "0.0",
    ]),
    adb([
      "-s",
      serial,
      "shell",
      "settings",
      "put",
      "global",
      "transition_animation_scale",
      "0.0",
    ]),
    adb([
      "-s",
      serial,
      "shell",
      "settings",
      "put",
      "global",
      "animator_duration_scale",
      "0.0",
    ]),
  ]);
}

async function dismissKeyguard(adb: AdbFn, serial: string): Promise<void> {
  await adb(["-s", serial, "shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  await adb(["-s", serial, "shell", "wm", "dismiss-keyguard"]);
}

/** Top-level post-session emulator configuration called from launch(). */
export async function configureEmulator(
  adb: AdbFn,
  serial: string,
): Promise<void> {
  await disableAnimations(adb, serial);
  await dismissKeyguard(adb, serial);
}
