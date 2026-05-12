import { afterEach, describe, expect, it, mock } from "bun:test";
import { PassThrough } from "node:stream";
import type {
  AppiumProcess,
  FindFreePortFn,
  SpawnAppiumFn,
} from "./createAppiumServer.js";
import { createAppiumServer } from "./createAppiumServer.js";

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
      overrides?.spawn ?? ((_bin, _args, _env) => fakeProcess);
    const findFreePort: FindFreePortFn = async () => 9515;
    const resolveAppiumBin = () => "/fake/appium";
    return { spawnFn, killFn, output, findFreePort, resolveAppiumBin };
  }

  it("should resolve with { port, home, stop } when banner is emitted", async () => {
    const { spawnFn, output, findFreePort, resolveAppiumBin } = makeTestDeps();
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

    const result = await createAppiumServer({
      deps: { spawn: spawnFn, findFreePort, resolveAppiumBin },
      options: { appiumHome: "/tmp/appium-home", startTimeoutMs: 1_000 },
    });

    expect(result.port).toBe(9515);
    expect(result.home).toBe("/tmp/appium-home");
    expect(typeof result.stop).toBe("function");
  });

  it("should call kill when stop is invoked", async () => {
    const { spawnFn, killFn, output, findFreePort, resolveAppiumBin } =
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

    const result = await createAppiumServer({
      deps: { spawn: spawnFn, findFreePort, resolveAppiumBin },
      options: { appiumHome: "/tmp/appium-home", startTimeoutMs: 1_000 },
    });
    result.stop();

    expect(killFn).toHaveBeenCalledTimes(1);
  });

  it("should reject when process exits before banner", async () => {
    const { findFreePort, resolveAppiumBin } = makeTestDeps();
    const earlyExitSpawn: SpawnAppiumFn = (_bin, _args, _env) => ({
      output: new PassThrough(),
      kill: () => {},
      exitCode: Promise.resolve(1),
    });

    let caught: unknown;
    try {
      await createAppiumServer({
        deps: { spawn: earlyExitSpawn, findFreePort, resolveAppiumBin },
        options: { startTimeoutMs: 5_000 },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "Appium process exited unexpectedly with code 1",
    );
  });

  it("should reject when startup banner does not appear within timeout", async () => {
    const { findFreePort, resolveAppiumBin } = makeTestDeps();
    const hangingSpawn: SpawnAppiumFn = (_bin, _args, _env) => ({
      output: new PassThrough(),
      kill: () => {},
      exitCode: new Promise<number>(() => {}),
    });

    let caught: unknown;
    try {
      await createAppiumServer({
        deps: { spawn: hangingSpawn, findFreePort, resolveAppiumBin },
        options: { startTimeoutMs: 50 },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("did not start");
  });

  it("should reject when resolveAppiumBin throws", async () => {
    const { spawnFn, findFreePort } = makeTestDeps();
    const failResolve = () => {
      throw new Error(
        "Appium not found in node_modules. Install it by running: qawolf install",
      );
    };

    let caught: unknown;
    try {
      await createAppiumServer({
        deps: { spawn: spawnFn, findFreePort, resolveAppiumBin: failResolve },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "Appium not found in node_modules. Install it by running: qawolf install",
    );
  });
});
