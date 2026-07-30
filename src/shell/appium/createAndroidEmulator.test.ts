import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AdbFn } from "./adb.js";
import type { SpawnEmulatorFn } from "./createAndroidEmulator.js";
import { createAndroidEmulator } from "./createAndroidEmulator.js";

afterEach(() => {
  mock.restore();
});

function makeAdb(bootCompleted = true): AdbFn {
  return async (args) => {
    if (args.includes("wait-for-device")) return { stdout: "" };
    if (args.includes("getprop"))
      return { stdout: bootCompleted ? "1\n" : "0\n" };
    return { stdout: "" };
  };
}

describe("createAndroidEmulator", () => {
  it("resolves with serial and stop when adb confirms boot", async () => {
    const stopFn = mock(() => {});
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: stopFn });

    const result = await createAndroidEmulator({
      avdName: "Pixel_4",
      port: 5554,
      deps: { spawn: spawnFn, adb: makeAdb(true) },
    });

    expect(result.serial).toBe("emulator-5554");
    expect(typeof result.stop).toBe("function");
  });

  it("calls proc stop when stop() is invoked", async () => {
    const stopFn = mock(() => {});
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: stopFn });

    const result = await createAndroidEmulator({
      avdName: "Pixel_4",
      port: 5554,
      deps: { spawn: spawnFn, adb: makeAdb(true) },
    });
    result.stop();

    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("kills proc and rethrows when boot times out", async () => {
    const stopFn = mock(() => {});
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: stopFn });
    const hangingAdb: AdbFn = async (args) => {
      if (args.includes("wait-for-device")) return { stdout: "" };
      return { stdout: "0\n" }; // never signals boot_completed=1
    };

    let caught: unknown;
    try {
      await createAndroidEmulator({
        avdName: "Pixel_4",
        port: 5554,
        deps: { spawn: spawnFn, adb: hangingAdb },
        options: { bootTimeoutMs: 50 },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("did not finish booting");
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("serial uses the provided port", async () => {
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: () => {} });

    const result = await createAndroidEmulator({
      avdName: "Pixel_7",
      port: 5560,
      deps: { spawn: spawnFn, adb: makeAdb(true) },
    });

    expect(result.serial).toBe("emulator-5560");
  });

  it("rejects and kills proc when boot sequence throws", async () => {
    const stopFn = mock(() => {});
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: stopFn });
    const failingAdb: AdbFn = async (args) => {
      if (args.includes("wait-for-device")) throw new Error("adb server died");
      return { stdout: "" };
    };

    let caught: unknown;
    try {
      await createAndroidEmulator({
        avdName: "Pixel_4",
        port: 5554,
        deps: { spawn: spawnFn, adb: failingAdb },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("adb server died");
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("does not crash when adb wait-for-device rejects after timeout", async () => {
    const spawnFn: SpawnEmulatorFn = (_bin, _args) => ({ stop: () => {} });
    // wait-for-device outlasts the boot timeout, then rejects — simulates adb server
    // dying after Promise.race has already settled with the deadline error.
    const adbWithDelayedRejection: AdbFn = (args) => {
      if (args.includes("wait-for-device")) {
        return new Promise<{ stdout: string }>((_, reject) =>
          setTimeout(() => reject(new Error("adb server died")), 100),
        );
      }
      return Promise.resolve({ stdout: "" });
    };

    let caught: unknown;
    try {
      await createAndroidEmulator({
        avdName: "Pixel_4",
        port: 5554,
        deps: { spawn: spawnFn, adb: adbWithDelayedRejection },
        options: { bootTimeoutMs: 50 },
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("did not finish booting");
    // Wait for the background wait-for-device to reject; an unhandled rejection here
    // would crash the Bun process and fail the test suite.
    await new Promise<void>((r) => setTimeout(r, 100));
  });
});
