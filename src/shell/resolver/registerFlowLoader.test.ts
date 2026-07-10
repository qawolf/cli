import { afterEach, describe, expect, it, mock } from "bun:test";

import { registerFlowLoader } from "./registerFlowLoader.js";
import type { RuntimeCapabilities } from "./selectFlowLoaderStrategy.js";

const bun: RuntimeCapabilities = {
  isBun: true,
  hasSyncHooks: true,
  hasNativeTypeScript: false,
  hasAsyncRegister: true,
};
const modernNode: RuntimeCapabilities = {
  isBun: false,
  hasSyncHooks: true,
  hasNativeTypeScript: true,
  hasAsyncRegister: true,
};
const node20: RuntimeCapabilities = {
  isBun: false,
  hasSyncHooks: false,
  hasNativeTypeScript: false,
  hasAsyncRegister: true,
};
const nodeBelow206: RuntimeCapabilities = {
  isBun: false,
  hasSyncHooks: false,
  hasNativeTypeScript: false,
  hasAsyncRegister: false,
};

afterEach(() => {
  mock.restore();
});

describe("registerFlowLoader", () => {
  it("registers nothing under Bun", async () => {
    const registerSyncAlias = mock(() => undefined);
    const registerOxcLoader = mock(() => Promise.resolve());

    await registerFlowLoader({
      capabilities: bun,
      registerSyncAlias,
      registerOxcLoader,
    });

    expect(registerSyncAlias).not.toHaveBeenCalled();
    expect(registerOxcLoader).not.toHaveBeenCalled();
  });

  it("registers the sync alias hook on modern Node with native TS", async () => {
    const registerSyncAlias = mock(() => undefined);
    const registerOxcLoader = mock(() => Promise.resolve());

    await registerFlowLoader({
      capabilities: modernNode,
      registerSyncAlias,
      registerOxcLoader,
    });

    expect(registerSyncAlias).toHaveBeenCalledTimes(1);
    expect(registerOxcLoader).not.toHaveBeenCalled();
  });

  it("registers the oxc transpiling loader on Node 20", async () => {
    const registerSyncAlias = mock(() => undefined);
    const registerOxcLoader = mock(() => Promise.resolve());

    await registerFlowLoader({
      capabilities: node20,
      registerSyncAlias,
      registerOxcLoader,
    });

    expect(registerOxcLoader).toHaveBeenCalledTimes(1);
    expect(registerSyncAlias).not.toHaveBeenCalled();
  });

  it("throws a clear error on a Node without any TypeScript loader (< 20.6)", async () => {
    const registerSyncAlias = mock(() => undefined);
    const registerOxcLoader = mock(() => Promise.resolve());

    let caught: unknown;
    try {
      await registerFlowLoader({
        capabilities: nodeBelow206,
        registerSyncAlias,
        registerOxcLoader,
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("20.6");
    expect(registerSyncAlias).not.toHaveBeenCalled();
    expect(registerOxcLoader).not.toHaveBeenCalled();
  });
});
