import { spawn } from "node:child_process";

import { emulatorBin } from "~/core/androidBins.js";
import { defaultAdb, type AdbFn } from "./adb.js";

const defaultBootTimeoutMs = 120_000;
const pollIntervalMs = 2_000;

function androidHome(): string | undefined {
  return process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
}

export type SpawnFn = (bin: string, args: string[]) => { stop: () => void };

const defaultSpawn: SpawnFn = (bin, args) => {
  const child = spawn(bin, args, { stdio: "ignore" });
  child.unref();
  return { stop: () => child.kill() };
};

async function bootSequence(
  adb: AdbFn,
  serial: string,
  cancelled: () => boolean,
): Promise<void> {
  await adb(["-s", serial, "wait-for-device"]);
  while (!cancelled()) {
    const { stdout } = await adb([
      "-s",
      serial,
      "shell",
      "getprop",
      "sys.boot_completed",
    ]).catch(() => ({ stdout: "" }));
    if (stdout.trim() === "1") return;
    await new Promise<void>((r) => setTimeout(r, pollIntervalMs));
  }
}

function waitForBoot(
  adb: AdbFn,
  serial: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      reject(
        new Error(
          `Android emulator did not finish booting within ${timeoutMs / 1000}s`,
        ),
      );
    }, timeoutMs);
    void bootSequence(adb, serial, () => done)
      .then(() => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      })
      .catch((err: unknown) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          reject(err as Error);
        }
      });
  });
}

export async function createAndroidEmulator(params: {
  avdName: string;
  port: number;
  deps?: { spawn?: SpawnFn; adb?: AdbFn };
  options?: { bootTimeoutMs?: number };
}): Promise<{ serial: string; stop: () => void }> {
  const { avdName, port } = params;
  const spawnFn = params.deps?.spawn ?? defaultSpawn;
  const adbFn = params.deps?.adb ?? defaultAdb;
  const timeoutMs = params.options?.bootTimeoutMs ?? defaultBootTimeoutMs;
  const serial = `emulator-${port}`;

  const proc = spawnFn(emulatorBin(androidHome(), process.platform), [
    "-avd",
    avdName,
    "-no-audio",
    "-no-window",
    "-port",
    String(port),
  ]);

  try {
    await waitForBoot(adbFn, serial, timeoutMs);
  } catch (err) {
    proc.stop();
    throw err;
  }

  let stopped = false;
  return {
    serial,
    stop: () => {
      if (stopped) return;
      stopped = true;
      proc.stop();
    },
  };
}
