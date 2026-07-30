import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type {
  AppiumProcess,
  FindFreePortFn,
  SpawnAppiumFn,
} from "./createAppiumServer.js";
import { createAppiumServer } from "./createAppiumServer.js";

const noopSignals = makeNoopSignals();

function emitBanner(output: PassThrough) {
  setTimeout(
    () =>
      output.emit(
        "data",
        Buffer.from(
          "Appium REST http interface listener started on http://localhost:9515\n",
        ),
      ),
    10,
  );
}

afterEach(() => {
  mock.restore();
});

describe("createAppiumServer", () => {
  function makeTestDeps(overrides?: {
    spawn?: SpawnAppiumFn;
    output?: PassThrough;
  }) {
    const output = overrides?.output ?? new PassThrough();
    const killFn = mock(() => {});
    const fakeProcess: AppiumProcess = {
      output,
      kill: killFn,
      exitCode: new Promise<number>(() => {}),
    };
    const spawnFn: SpawnAppiumFn =
      overrides?.spawn ?? ((_bin, _args, _platform, _env) => fakeProcess);
    const findFreePort: FindFreePortFn = async () => 9515;
    const checkExists = () => true;
    return { spawnFn, killFn, output, findFreePort, checkExists };
  }

  it("should resolve with { port, home, stop } when banner is emitted", async () => {
    const { spawnFn, output, findFreePort, checkExists } = makeTestDeps();
    setTimeout(
      () =>
        output.emit(
          "data",
          Buffer.from(
            "Appium REST http interface listener started on http://localhost:9515\n",
          ),
        ),
      10,
    );

    const result = await createAppiumServer("/fake/env", noopSignals, {
      deps: { spawn: spawnFn, findFreePort, checkExists },
      options: { appiumHome: "/tmp/appium-home", startTimeoutMs: 1_000 },
    });

    expect(result.port).toBe(9515);
    expect(result.home).toBe("/tmp/appium-home");
    expect(typeof result.stop).toBe("function");
  });

  it("should expose exited promise that resolves with the process exit code", async () => {
    const { findFreePort, checkExists } = makeTestDeps();
    const output = new PassThrough();
    let resolveExit!: (code: number) => void;
    const exitCode = new Promise<number>((res) => {
      resolveExit = res;
    });
    const spawnFn: SpawnAppiumFn = (_bin, _args, _platform, _env) => ({
      output,
      kill: mock(() => {}),
      exitCode,
    });
    setTimeout(
      () =>
        output.emit(
          "data",
          Buffer.from(
            "Appium REST http interface listener started on http://localhost:9515\n",
          ),
        ),
      10,
    );

    const result = await createAppiumServer("/fake/env", noopSignals, {
      deps: { spawn: spawnFn, findFreePort, checkExists },
      options: { appiumHome: "/tmp/appium-home", startTimeoutMs: 1_000 },
    });
    resolveExit(0);

    expect(await result.exited).toBe(0);
  });

  it("should call kill when stop is invoked", async () => {
    const { spawnFn, killFn, output, findFreePort, checkExists } =
      makeTestDeps();
    setTimeout(
      () =>
        output.emit(
          "data",
          Buffer.from(
            "Appium REST http interface listener started on http://localhost:9515\n",
          ),
        ),
      10,
    );

    const result = await createAppiumServer("/fake/env", noopSignals, {
      deps: { spawn: spawnFn, findFreePort, checkExists },
      options: { appiumHome: "/tmp/appium-home", startTimeoutMs: 1_000 },
    });
    result.stop();

    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("should reject when process exits before banner", async () => {
    const { findFreePort, checkExists } = makeTestDeps();
    const killFn = mock(() => {});
    const earlyExitSpawn: SpawnAppiumFn = (_bin, _args, _platform, _env) => ({
      output: new PassThrough(),
      kill: killFn,
      exitCode: Promise.resolve(1),
    });

    let caught: unknown;
    try {
      await createAppiumServer("/fake/env", noopSignals, {
        deps: { spawn: earlyExitSpawn, findFreePort, checkExists },
        options: { startTimeoutMs: 5_000 },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "Appium process exited unexpectedly with code 1",
    );
    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("should reject when startup banner does not appear within timeout", async () => {
    const { findFreePort, checkExists } = makeTestDeps();
    const killFn = mock(() => {});
    const hangingSpawn: SpawnAppiumFn = (_bin, _args, _platform, _env) => ({
      output: new PassThrough(),
      kill: killFn,
      exitCode: new Promise<number>(() => {}),
    });

    let caught: unknown;
    try {
      await createAppiumServer("/fake/env", noopSignals, {
        deps: { spawn: hangingSpawn, findFreePort, checkExists },
        options: { startTimeoutMs: 50 },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("did not start");
    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("should spawn the win32 shim with the win32 platform when platform is win32", async () => {
    const { output, findFreePort } = makeTestDeps();
    const spawnCalls: { bin: string; platform: NodeJS.Platform }[] = [];
    const spawnFn: SpawnAppiumFn = (bin, _args, platform, _env) => {
      spawnCalls.push({ bin, platform });
      return { output, kill: mock(() => {}), exitCode: new Promise(() => {}) };
    };
    const winShim = join("/fake/env", "node_modules", ".bin", "appium.cmd");
    emitBanner(output);

    await createAppiumServer("/fake/env", noopSignals, {
      deps: { spawn: spawnFn, findFreePort, checkExists: (p) => p === winShim },
      options: { platform: "win32", startTimeoutMs: 1_000 },
    });

    expect(spawnCalls).toEqual([{ bin: winShim, platform: "win32" }]);
  });

  it("should reject without spawning when no binary exists on disk", async () => {
    const { output, findFreePort } = makeTestDeps();
    const spawnCalls: string[] = [];
    const spawnFn: SpawnAppiumFn = (bin, _args, _platform, _env) => {
      spawnCalls.push(bin);
      return { output, kill: mock(() => {}), exitCode: new Promise(() => {}) };
    };

    let caught: unknown;
    try {
      await createAppiumServer("/fake/env", noopSignals, {
        deps: { spawn: spawnFn, findFreePort, checkExists: () => false },
        options: { platform: "linux", startTimeoutMs: 1_000 },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      `appium not found at ${join("/fake/env", "node_modules", ".bin", "appium")}.\n` +
        "Reinstall the runtime dependencies with `qawolf install`.",
    );
    expect(spawnCalls).toEqual([]);
  });
});
