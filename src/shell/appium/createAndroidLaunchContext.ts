import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmulatorSlot } from "./createEmulatorPool.js"; // (D2)
import { configureEmulator, defaultAdb } from "./emulatorSetup.js";
import type {
  AndroidCleanupResult,
  AndroidLaunchContext,
  AndroidLaunchDeps,
  AndroidLaunchOptions,
  AppiumDriver,
  WriteFileFn,
} from "./types.js";

const defaultWriteFile: WriteFileFn = (filePath, data) =>
  writeFile(filePath, data); // (D1)

export function createAndroidLaunchContext({
  deps,
  options,
}: {
  deps: AndroidLaunchDeps;
  options: AndroidLaunchOptions;
}): AndroidLaunchContext {
  const adbFn = deps.adb ?? defaultAdb;
  const writeFileFn = deps.writeFile ?? defaultWriteFile;

  let slot: EmulatorSlot | undefined;
  let driver: AppiumDriver | undefined;
  let cleanedUp = false;

  const launch = async (): Promise<void> => {
    if (driver !== undefined) {
      throw new Error("launch() already called on this context");
    }
    slot = await deps.emulatorPool.checkOut(options.avdName);
    try {
      driver = await deps.createSession(deps.appiumServer.port, slot.serial);
      await configureEmulator(adbFn, slot.serial);
      if (options.recordVideo) {
        await driver.startRecordingScreen();
      }
    } catch (err) {
      // Clean up any Appium session that was opened before the failure.
      // Await before checkIn to avoid the slot being re-allocated while the
      // previous session is still tearing down.
      if (driver !== undefined) {
        await driver.deleteSession().catch(() => {}); // best-effort; original error is re-thrown below
        driver = undefined;
      }
      deps.emulatorPool.checkIn(slot);
      slot = undefined;
      throw err;
    }
  };

  const pages = (): AppiumDriver[] => (driver !== undefined ? [driver] : []);

  const cleanup = async (_passed: boolean): Promise<AndroidCleanupResult> => {
    if (cleanedUp) return { videoPaths: [], tracePaths: [] };
    cleanedUp = true;

    const videoPaths: string[] = [];

    // Stop recording before ending the session — the session must still be alive.
    if (driver !== undefined && options.recordVideo) {
      try {
        const base64Video = await driver.stopRecordingScreen();
        const videoPath = path.join(options.outputDir, "video.mp4");
        await writeFileFn(videoPath, Buffer.from(base64Video, "base64"));
        videoPaths.push(videoPath);
      } catch {
        // best-effort; don't block cleanup on video failure
      }
    }

    // End session and return slot concurrently — independent of each other.
    const tasks: Promise<unknown>[] = [];
    if (driver !== undefined) tasks.push(driver.deleteSession());
    if (slot !== undefined) {
      const captured = slot;
      tasks.push(Promise.resolve(deps.emulatorPool.checkIn(captured)));
    }
    await Promise.allSettled(tasks);

    return { videoPaths, tracePaths: [] };
  };

  return { launch, pages, cleanup };
}
