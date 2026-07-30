import {
  createAndroidEmulator,
  type SpawnFn,
} from "./createAndroidEmulator.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import type { AdbFn } from "./adb.js";

export type EmulatorSlot = { serial: string; avdName: string };

const baseConsolePort = 5554;

export function createEmulatorPool(params: {
  signals: SignalRegistry;
  deps?: { spawn?: SpawnFn; adb?: AdbFn };
}): {
  bootForAvd: (avdName: string, count: number) => Promise<void>;
  checkOut: (avdName: string) => Promise<EmulatorSlot>;
  checkIn: (slot: EmulatorSlot) => void;
  closeAll: () => void;
} {
  let closed = false;
  let nextPort = baseConsolePort;
  const freeSlots = new Map<string, EmulatorSlot[]>();
  const waiters = new Map<
    string,
    { resolve: (slot: EmulatorSlot) => void; reject: (err: Error) => void }[]
  >();
  const handles: { stop: () => void }[] = [];
  const inFlightBoots = new Set<
    Promise<{ serial: string; stop: () => void }>
  >();
  const bootedAvds = new Set<string>();

  let closeAllImpl: () => void = () => {};
  const unregister = params.signals.register(() => closeAllImpl());

  const pool = {
    async bootForAvd(avdName: string, count: number) {
      if (bootedAvds.has(avdName)) return;
      bootedAvds.add(avdName);

      const boots = Array.from({ length: count }, () => {
        const port = nextPort;
        nextPort += 2;
        const p = createAndroidEmulator({
          avdName,
          port,
          ...(params.deps !== undefined ? { deps: params.deps } : {}),
        });
        inFlightBoots.add(p);
        void p.finally(() => inFlightBoots.delete(p));
        return p;
      });

      const settled = await Promise.allSettled(boots);
      const successes = settled.filter(
        (
          r,
        ): r is PromiseFulfilledResult<{ serial: string; stop: () => void }> =>
          r.status === "fulfilled",
      );
      const failure = settled.find(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failure) {
        for (const s of successes) s.value.stop();
        bootedAvds.delete(avdName);
        throw failure.reason;
      }
      if (closed) {
        for (const s of successes) s.value.stop();
        return;
      }
      const results = successes.map((r) => r.value);

      const free = freeSlots.get(avdName) ?? [];
      freeSlots.set(avdName, free);
      for (const r of results) {
        handles.push(r);
        const slot: EmulatorSlot = { serial: r.serial, avdName };
        const waiter = waiters.get(avdName)?.shift();
        if (waiter) {
          waiter.resolve(slot);
        } else {
          free.push(slot);
        }
      }
    },

    checkOut(avdName: string) {
      const next = freeSlots.get(avdName)?.shift();
      if (next) return Promise.resolve(next);

      return new Promise<EmulatorSlot>((resolve, reject) => {
        const pending = waiters.get(avdName) ?? [];
        waiters.set(avdName, pending);
        pending.push({ resolve, reject });
      });
    },

    checkIn(slot: EmulatorSlot) {
      if (closed) return;
      const waiter = waiters.get(slot.avdName)?.shift();
      if (waiter) {
        waiter.resolve(slot);
      } else {
        const free = freeSlots.get(slot.avdName) ?? [];
        freeSlots.set(slot.avdName, free);
        free.push(slot);
      }
    },

    closeAll(this: void) {
      unregister();
      closed = true;
      for (const h of handles) h.stop();
      handles.length = 0;
      freeSlots.clear();
      for (const p of inFlightBoots) {
        void p.then((e) => e.stop()).catch(() => {});
      }
      inFlightBoots.clear();
      for (const pending of waiters.values()) {
        for (const waiter of pending) {
          waiter.reject(new Error("Pool closed"));
        }
      }
      waiters.clear();
      bootedAvds.clear();
      nextPort = baseConsolePort;
    },
  };

  closeAllImpl = pool.closeAll;
  return pool;
}
