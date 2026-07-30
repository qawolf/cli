import { afterEach, describe, expect, it, mock } from "bun:test";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { installUiautomator2Driver } from "./driver.js";

afterEach(() => {
  mock.restore();
});

const appiumBinPath = "/env/node_modules/.bin/appium";
const success: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };

type SpawnOpts = Parameters<SpawnFn>[2];

function makeSpawn(overrides: Record<string, SpawnResult> = {}): {
  fn: SpawnFn;
  calls: [string, string[], SpawnOpts][];
} {
  const calls: [string, string[], SpawnOpts][] = [];
  const fn: SpawnFn = (cmd, args, opts) => {
    calls.push([cmd, args, opts]);
    // key on the subcommand: "list" or "install"
    const key = args[1] ?? args[0] ?? cmd;
    return Promise.resolve(overrides[key] ?? success);
  };
  return { fn, calls };
}

function makeCtx(): CommandContext {
  return {
    ui: {
      step: mock(() => {}),
      info: mock(() => {}),
      success: mock(() => {}),
      error: mock(() => {}),
      warn: mock(() => {}),
    },
    configDir: "/tmp",
    outputMode: "human",
    isInteractive: false,
    apiBaseUrl: "https://app.qawolf.com",
  } as unknown as CommandContext;
}

function makeDeps(spawn: SpawnFn) {
  return { spawn, appiumBinPath, platform: "linux" as NodeJS.Platform };
}

describe("installUiautomator2Driver", () => {
  it("should skip install when uiautomator2 appears in driver list stdout or stderr", async () => {
    for (const [stdout, stderr] of [
      ["  uiautomator2@3.7.0 [installed]", ""] as const,
      ["", "  uiautomator2@3.7.0 [installed]"] as const,
    ]) {
      const { fn: spawn, calls } = makeSpawn({
        list: { exitCode: 0, stdout, stderr },
      });
      await installUiautomator2Driver(makeCtx(), makeDeps(spawn));
      expect(
        calls.find(
          ([cmd, args]) => cmd === appiumBinPath && args[1] === "install",
        ),
      ).toBeUndefined();
    }
  });

  it("should treat already-installed error from appium driver install as success", async () => {
    const { fn: spawn } = makeSpawn({
      install: {
        exitCode: 1,
        stdout: "",
        stderr:
          '✖ A driver named "uiautomator2" is already installed. Did you mean to update?',
      },
    });
    const ctx = makeCtx();
    await installUiautomator2Driver(ctx, makeDeps(spawn));
    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("already installed"),
    );
  });

  it("should include exit code in error when appium install produces no output", async () => {
    const { fn: spawn } = makeSpawn({
      install: { exitCode: 1, stdout: "", stderr: "" },
    });
    let caught: unknown;
    try {
      await installUiautomator2Driver(makeCtx(), makeDeps(spawn));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("exit code 1");
  });

  it("should call appium driver install uiautomator2 when driver is absent", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installUiautomator2Driver(makeCtx(), makeDeps(spawn));
    const installCall = calls.find(
      ([cmd, args]) => cmd === appiumBinPath && args[1] === "install",
    );
    expect(installCall?.[1][0]).toBe("driver");
    expect(installCall?.[1][1]).toBe("install");
    expect(installCall?.[1][2]).toMatch(/^uiautomator2@/);
  });

  it("should pass APPIUM_HOME env to both list and install spawn calls", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installUiautomator2Driver(makeCtx(), makeDeps(spawn));
    for (const [, , opts] of calls) {
      expect(opts?.env?.["APPIUM_HOME"]).toMatch(/appium$/);
    }
  });
});
