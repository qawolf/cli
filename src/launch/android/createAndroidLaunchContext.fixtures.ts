import { mock } from "bun:test";
import type { EmulatorSlot } from "~/android/createEmulatorPool.js";
import { createAndroidLaunchContext } from "./createAndroidLaunchContext.js";
import type {
  AndroidLaunchDeps,
  AndroidLaunchOptions,
  AppiumDriver,
} from "./types.js";

export const testSlot: EmulatorSlot = {
  serial: "emulator-5554",
  avdName: "test-avd",
};

export function makeDriver(
  overrides: Partial<AppiumDriver> = {},
): AppiumDriver {
  return {
    startRecordingScreen: async () => {},
    stopRecordingScreen: async () => Buffer.from("fake-mp4").toString("base64"),
    deleteSession: async () => {},
    ...overrides,
  };
}

export function makePool(slot = testSlot) {
  const checkOut = mock(async (_avdName: string) => slot);
  const checkIn = mock((_s: EmulatorSlot) => {});
  return { checkOut, checkIn };
}

export const baseOptions: AndroidLaunchOptions = {
  avdName: "test-avd",
  recordVideo: false,
  outputDir: "/tmp/qawolf-android-test",
};

export function makeBaseDeps(
  overrides: Partial<AndroidLaunchDeps> = {},
): AndroidLaunchDeps {
  return {
    appiumServer: { port: 4723, home: "/tmp/appium", stop: () => {} },
    emulatorPool: makePool(),
    createSession: async () => makeDriver(),
    adb: mock(async (_args: string[]) => ({ stdout: "" })),
    spawn: mock((_bin: string, _args: string[]) => ({ stop: () => {} })),
    ...overrides,
  };
}

export function makeCtx(
  deps: Partial<AndroidLaunchDeps> = {},
  opts: Partial<AndroidLaunchOptions> = {},
) {
  return createAndroidLaunchContext({
    deps: makeBaseDeps(deps),
    options: { ...baseOptions, ...opts },
  });
}
