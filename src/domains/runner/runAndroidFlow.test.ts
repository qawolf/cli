import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  makeBaseDeps,
  makePool,
} from "~/shell/appium/createAndroidLaunchContext.fixtures.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type {
  RunAndroidFlowDeps,
  RunAndroidFlowOptions,
} from "./runAndroidFlow.js";
import { runAndroidFlow } from "./runAndroidFlow.js";
import type { FlowRuntimeDeps } from "./flowRuntimeDeps.js";

afterEach(() => {
  mock.restore();
});

function makeRunnerDeps() {
  return {
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
      unlink: async () => {},
    },
    spawn: () => ({ exitCode: Promise.resolve(0), kill: () => {} }),
    signals: makeNoopSignals(),
    createStorage: <T>() => ({
      run: async (_store: T, callback: () => Promise<void>) => callback(),
      getStore: () => undefined,
    }),
  };
}

function makeAndroidDeps(): RunAndroidFlowDeps {
  return {
    ...makeBaseDeps(),
    ...makeRunnerDeps(),
  };
}

const baseOptions: RunAndroidFlowOptions = {
  retries: 0,
  outputDir: "/tmp/qawolf-android-test",
  recordVideo: false,
};

function fixturePath(name: string): string {
  return join(import.meta.dirname, `runAndroidFlow.${name}.fixture.ts`);
}

describe("runAndroidFlow", () => {
  it("should return passed: true when the flow succeeds", async () => {
    const result = await runAndroidFlow({
      deps: makeAndroidDeps(),
      options: baseOptions,
      flowPath: fixturePath("pass"),
    });
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("should return passed: false and capture error when the flow throws", async () => {
    const result = await runAndroidFlow({
      deps: makeAndroidDeps(),
      options: baseOptions,
      flowPath: fixturePath("fail"),
    });
    expect(result.passed).toBe(false);
    expect((result.error?.cause as Error)?.message).toMatch(
      "android flow failed",
    );
  });

  it("should call cleanup for all open contexts after the flow completes", async () => {
    const pool = makePool();
    const deps: RunAndroidFlowDeps = {
      ...makeBaseDeps({ emulatorPool: pool }),
      ...makeRunnerDeps(),
    };

    await runAndroidFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("launch"),
    });

    expect(pool.checkIn).toHaveBeenCalledTimes(1);
  });

  it("should call cleanup when the flow fails after calling startAndroid", async () => {
    const pool = makePool();
    const deps: RunAndroidFlowDeps = {
      ...makeBaseDeps({ emulatorPool: pool }),
      ...makeRunnerDeps(),
    };

    const result = await runAndroidFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("failAfterLaunch"),
    });

    expect(result.passed).toBe(false);
    expect(pool.checkIn).toHaveBeenCalledTimes(1);
  });

  it("should count all attempts when retries is set", async () => {
    const result = await runAndroidFlow({
      deps: makeAndroidDeps(),
      options: { ...baseOptions, retries: 1 },
      flowPath: fixturePath("fail"),
    });
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(2);
  });

  it("should not retry when FailWithoutRetryError is thrown", async () => {
    const result = await runAndroidFlow({
      deps: makeAndroidDeps(),
      options: { ...baseOptions, retries: 2 },
      flowPath: fixturePath("failNoRetry"),
    });
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should fail the flow when an unsupported shared dependency is called", async () => {
    const result = await runAndroidFlow({
      deps: makeAndroidDeps(),
      options: baseOptions,
      flowPath: fixturePath("getInbox"),
    });

    expect(result.passed).toBe(false);
    const cause = (result.error as Error & { cause?: unknown })?.cause;
    expect(cause).toBeInstanceOf(Error);
    expect((cause as Error).message).toContain("not supported");
  });

  it("should use injected shared runtime deps", async () => {
    const getInbox = mock(async () => undefined) as unknown as NonNullable<
      FlowRuntimeDeps["getInbox"]
    >;
    const result = await runAndroidFlow({
      deps: { ...makeAndroidDeps(), flowRuntimeDeps: { getInbox } },
      options: baseOptions,
      flowPath: fixturePath("getInbox"),
    });

    expect(result.passed).toBe(true);
    expect(getInbox).toHaveBeenCalledWith({ address: "test@example.com" });
  });
});
