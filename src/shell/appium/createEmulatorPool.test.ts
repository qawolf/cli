import { afterEach, describe, expect, it, mock } from "bun:test";
import type { AdbFn, SpawnFn } from "./createAndroidEmulator.js";
import { createEmulatorPool } from "./createEmulatorPool.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

const noopSignals = makeNoopSignals();

afterEach(() => {
  mock.restore();
});

function makeAdb(): AdbFn {
  return async (args) => {
    if (args.includes("wait-for-device")) return { stdout: "" };
    return { stdout: "1\n" };
  };
}

function makeSpawn(onStop?: () => void): SpawnFn {
  return (_bin, _args) => ({ stop: onStop ?? (() => {}) });
}

describe("createEmulatorPool", () => {
  it("bootForAvd boots count emulators and makes slots available", async () => {
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: makeSpawn(), adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 2);

    const slot1 = await pool.checkOut("Pixel_4");
    const slot2 = await pool.checkOut("Pixel_4");

    expect(slot1.avdName).toBe("Pixel_4");
    expect(slot2.avdName).toBe("Pixel_4");
    expect(slot1.serial).not.toBe(slot2.serial);
  });

  it("bootForAvd is a no-op when called twice for the same AVD", async () => {
    let spawnCount = 0;
    const countingSpawn: SpawnFn = (_bin, _args) => {
      spawnCount++;
      return { stop: () => {} };
    };
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: countingSpawn, adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 1);
    await pool.bootForAvd("Pixel_4", 1);

    expect(spawnCount).toBe(1);
  });

  it("checkIn returns slot to free list", async () => {
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: makeSpawn(), adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 1);
    const slot = await pool.checkOut("Pixel_4");
    pool.checkIn(slot);

    const slot2 = await pool.checkOut("Pixel_4");
    expect(slot2.serial).toBe(slot.serial);
  });

  it("checkIn dispatches to waiter when free list is empty", async () => {
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: makeSpawn(), adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 1);
    const slot = await pool.checkOut("Pixel_4"); // depletes free list

    let resolved = false;
    const pending = pool.checkOut("Pixel_4").then((s) => {
      resolved = true;
      return s;
    });

    pool.checkIn(slot);
    const resolvedSlot = await pending;

    expect(resolved).toBe(true);
    expect(resolvedSlot.serial).toBe(slot.serial);
  });

  it("closeAll stops all emulators and resets state", async () => {
    const stops: ReturnType<typeof mock<() => void>>[] = [];
    const trackingSpawn: SpawnFn = (_bin, _args) => {
      const s = mock(() => {});
      stops.push(s);
      return { stop: s };
    };
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: trackingSpawn, adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 2);
    pool.closeAll();

    expect(stops).toHaveLength(2);
    for (const s of stops) expect(s).toHaveBeenCalledTimes(1);
  });

  it("closeAll rejects pending checkOut waiters with Pool closed", async () => {
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: makeSpawn(), adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 1);
    await pool.checkOut("Pixel_4"); // depletes free list

    const pending = pool.checkOut("Pixel_4"); // creates a pending waiter

    pool.closeAll();

    let caughtError: unknown;
    try {
      await pending;
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("Pool closed");
  });

  it("bootForAvd works again for same AVD after closeAll", async () => {
    let spawnCount = 0;
    const countingSpawn: SpawnFn = (_bin, _args) => {
      spawnCount++;
      return { stop: () => {} };
    };
    const pool = createEmulatorPool({
      signals: noopSignals,
      deps: { spawn: countingSpawn, adb: makeAdb() },
    });

    await pool.bootForAvd("Pixel_4", 1);
    pool.closeAll();
    await pool.bootForAvd("Pixel_4", 1);

    expect(spawnCount).toBe(2);
  });
});
