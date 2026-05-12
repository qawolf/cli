import {
  createAndroidEmulator,
  type AdbFn,
  type SpawnFn,
} from "./createAndroidEmulator.js";

export type EmulatorSlot = { serial: string; avdName: string };

const baseConsolePort = 5554;

export function createEmulatorPool(params?: {
  deps?: { spawn?: SpawnFn; adb?: AdbFn };
}): {
  bootForAvd: (avdName: string, count: number) => Promise<void>;
  checkOut: (avdName: string) => Promise<EmulatorSlot>;
  checkIn: (avdName: string, slot: EmulatorSlot) => void;
  closeAll: () => void;
} {
  let nextPort = baseConsolePort;
  const freeSlots = new Map<string, EmulatorSlot[]>();
  const waiters = new Map<string, ((slot: EmulatorSlot) => void)[]>();
  const handles: { stop: () => void }[] = [];
  const bootedAvds = new Set<string>();

  return {
    async bootForAvd(avdName, count) {
      if (bootedAvds.has(avdName)) return;
      bootedAvds.add(avdName);

      const boots = Array.from({ length: count }, () => {
        const port = nextPort;
        nextPort += 2;
        return createAndroidEmulator({
          avdName,
          port,
          ...(params?.deps !== undefined ? { deps: params.deps } : {}),
        });
      });

      let results: { serial: string; stop: () => void }[];
      try {
        results = await Promise.all(boots);
      } catch (err) {
        bootedAvds.delete(avdName);
        throw err;
      }

      if (!freeSlots.has(avdName)) freeSlots.set(avdName, []);
      for (const r of results) {
        handles.push(r);
        freeSlots.get(avdName)!.push({ serial: r.serial, avdName });
      }
    },

    checkOut(avdName) {
      const free = freeSlots.get(avdName);
      if (free?.length) return Promise.resolve(free.shift()!);

      return new Promise((resolve) => {
        if (!waiters.has(avdName)) waiters.set(avdName, []);
        waiters.get(avdName)!.push(resolve);
      });
    },

    checkIn(_avdName, slot) {
      const waiter = waiters.get(slot.avdName)?.shift();
      if (waiter) {
        waiter(slot);
      } else {
        if (!freeSlots.has(slot.avdName)) freeSlots.set(slot.avdName, []);
        freeSlots.get(slot.avdName)!.push(slot);
      }
    },

    closeAll() {
      for (const h of handles) h.stop();
      handles.length = 0;
      freeSlots.clear();
      waiters.clear();
      bootedAvds.clear();
      nextPort = baseConsolePort;
    },
  };
}
