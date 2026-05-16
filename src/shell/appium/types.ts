import type { AdbFn } from "./createAndroidEmulator.js";
import type { EmulatorSlot } from "./createEmulatorPool.js"; // (D2)

export type AppiumDriver = {
  startRecordingScreen(): Promise<void>;
  /** Returns base64-encoded mp4 data. */
  stopRecordingScreen(): Promise<string>;
  deleteSession(): Promise<void>;
};

type AppiumServerHandle = {
  port: number;
  home: string;
  stop: () => void;
};

/**
 * Subset of the emulator pool used by the launch context.
 * `bootForAvd` and `closeAll` are intentionally excluded — the launch context
 * only acquires and releases individual slots; pool lifecycle is the caller's
 * responsibility.
 */
type EmulatorPoolHandle = {
  checkOut: (avdName: string) => Promise<EmulatorSlot>;
  checkIn: (slot: EmulatorSlot) => void;
};

type CreateSessionFn = (port: number, serial: string) => Promise<AppiumDriver>;

export type WriteFileFn = (filePath: string, data: Buffer) => Promise<void>; // (D1)

export type AndroidLaunchDeps = {
  appiumServer: AppiumServerHandle;
  emulatorPool: EmulatorPoolHandle;
  /** Required: no default until WebDriverIO is added in the runner wiring ticket. */
  createSession: CreateSessionFn;
  adb?: AdbFn;
  writeFile?: WriteFileFn;
};

export type AndroidLaunchOptions = {
  avdName: string;
  recordVideo: boolean;
  outputDir: string;
};

/**
 * Matches the shape of `CleanupResult` in `src/lib/runner/web/types.ts`.
 * `tracePaths` is always `[]` for Android — included for structural parity so
 * the runner core can accept either context type.
 */
export type AndroidCleanupResult = {
  videoPaths: string[];
  tracePaths: string[];
};

/**
 * Android-specific launch context. `pages()` returns `AppiumDriver[]` rather
 * than `MinimalPage[]`; the Android runner (separate ticket) receives drivers
 * directly and does not use Playwright's page API.
 */
export type AndroidLaunchContext = {
  launch(): Promise<void>;
  pages(): AppiumDriver[];
  cleanup(passed: boolean): Promise<AndroidCleanupResult>;
};
