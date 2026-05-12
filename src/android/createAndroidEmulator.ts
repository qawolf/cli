import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultBootTimeoutMs = 120_000;
const pollIntervalMs = 2_000;

function androidHome(): string | undefined {
  return process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
}

function emulatorBin(): string {
  const home = androidHome();
  return home ? `${home}/emulator/emulator` : "emulator";
}

function adbBin(): string {
  const home = androidHome();
  return home ? `${home}/platform-tools/adb` : "adb";
}

export type SpawnFn = (bin: string, args: string[]) => { stop: () => void };
export type AdbFn = (args: string[]) => Promise<{ stdout: string }>;

const defaultSpawn: SpawnFn = (bin, args) => {
  const child = spawn(bin, args, { stdio: "ignore" });
  child.unref();
  return { stop: () => child.kill() };
};

const defaultAdb: AdbFn = async (args) => {
  const { stdout } = await execFileAsync(adbBin(), args);
  return { stdout };
};

async function bootSequence(adb: AdbFn, serial: string): Promise<void> {
  await adb(["-s", serial, "wait-for-device"]);
  while (true) {
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

async function waitForBoot(
  adb: AdbFn,
  serial: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            `Android emulator did not finish booting within ${timeoutMs / 1000}s`,
          ),
        ),
      timeoutMs,
    ),
  );
  await Promise.race([bootSequence(adb, serial), deadline]);
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

  const proc = spawnFn(emulatorBin(), [
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

  return { serial, stop: () => proc.stop() };
}
