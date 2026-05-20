import { describe, expect, it } from "bun:test";
import { createSignalRegistry } from "./createSignalRegistry.js";

describe("createSignalRegistry", () => {
  it("fires every registered cleanup on shutdown", async () => {
    const reg = createSignalRegistry();
    const calls: string[] = [];
    reg.register(() => {
      calls.push("a");
    });
    reg.register(() => {
      calls.push("b");
    });
    reg.register(() => {
      calls.push("c");
    });

    await reg.shutdown("test");

    expect(calls.sort()).toEqual(["a", "b", "c"]);
  });

  it("starts cleanups in reverse-registration order", async () => {
    const reg = createSignalRegistry();
    const startOrder: number[] = [];
    reg.register(() => {
      startOrder.push(0);
    });
    reg.register(() => {
      startOrder.push(1);
    });
    reg.register(() => {
      startOrder.push(2);
    });

    await reg.shutdown("test");

    expect(startOrder).toEqual([2, 1, 0]);
  });

  it("unregister removes a cleanup", async () => {
    const reg = createSignalRegistry();
    const calls: string[] = [];
    const unregisterA = reg.register(() => {
      calls.push("a");
    });
    reg.register(() => {
      calls.push("b");
    });
    unregisterA();

    await reg.shutdown("test");

    expect(calls).toEqual(["b"]);
  });

  it("unregister after shutdown started is a no-op (in-flight cleanup still fires)", async () => {
    const reg = createSignalRegistry();
    let fired = false;
    let resolveCleanup!: () => void;
    const unregisterA = reg.register(
      () =>
        new Promise<void>((resolve) => {
          fired = true;
          resolveCleanup = resolve;
        }),
    );

    const shutdownPromise = reg.shutdown("test");
    unregisterA();
    resolveCleanup();
    await shutdownPromise;

    expect(fired).toBe(true);
  });

  it("shutdown is idempotent — cleanups run once, both calls share a promise", async () => {
    const reg = createSignalRegistry();
    let count = 0;
    reg.register(() => {
      count++;
    });

    const p1 = reg.shutdown("a");
    const p2 = reg.shutdown("b");

    expect(p1).toBe(p2);
    await p1;
    expect(count).toBe(1);
  });

  it("times out a hanging cleanup and warns via log", async () => {
    const warnings: string[] = [];
    const reg = createSignalRegistry({
      timeoutMs: 20,
      log: (msg) => warnings.push(msg),
    });
    reg.register(() => new Promise<void>(() => {})); // never resolves
    reg.register(() => {}); // resolves immediately

    const start = Date.now();
    await reg.shutdown("test");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(200);
    expect(
      warnings.some((w) =>
        w.startsWith("[signals] 1 cleanup(s) did not finish"),
      ),
    ).toBe(true);
  });

  it("an error in one cleanup does not block other cleanups", async () => {
    const errors: string[] = [];
    const reg = createSignalRegistry({ log: (msg) => errors.push(msg) });
    let bRan = false;
    reg.register(() => {
      throw new Error("boom");
    });
    reg.register(() => {
      bRan = true;
    });

    await reg.shutdown("test");

    expect(bRan).toBe(true);
    expect(errors.some((m) => m.includes("boom"))).toBe(true);
  });

  it("registering during shutdown does not affect the in-flight shutdown", async () => {
    const reg = createSignalRegistry();
    let lateRan = false;
    reg.register(() => {
      reg.register(() => {
        lateRan = true;
      });
    });

    await reg.shutdown("test");

    expect(lateRan).toBe(false);
  });
});
