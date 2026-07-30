import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { installAndroid } from "./index.js";

afterEach(() => {
  mock.restore();
});

const sdk = "/sdk";
const binDir = join(sdk, "cmdline-tools", "latest", "bin");
const sdkManagerPath = join(binDir, "sdkmanager");
const appiumBinPath = join("/cwd", "node_modules", ".bin", "appium");

const success: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };

function makeSpawn(overrides: Record<string, SpawnResult> = {}): {
  fn: SpawnFn;
  calls: Parameters<SpawnFn>[];
} {
  const calls: Parameters<SpawnFn>[] = [];
  const fn: SpawnFn = (cmd, args, opts) => {
    calls.push([cmd, args, opts]);
    const key = args[0] ?? cmd;
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

function makeDeps(
  overrides: {
    spawn?: SpawnFn;
    peekFlowMeta?: (
      f: string,
    ) => Promise<{ name: string | undefined; target: string | undefined }>;
    arch?: NodeJS.Architecture;
    expandPatterns?: () => Promise<string[]>;
    checkExists?: (path: string) => boolean;
  } = {},
) {
  return {
    cwd: "/cwd",
    spawn: overrides.spawn ?? makeSpawn().fn,
    arch: overrides.arch ?? "arm64",
    androidHome: sdk,
    // Runtime deps are installed; no AVD or license file exists yet.
    checkExists:
      overrides.checkExists ?? ((path: string) => path.includes(".bin")),
    platform: "linux" as NodeJS.Platform,
    expandPatterns: overrides.expandPatterns ?? (async () => ["/flow.ts"]),
    peekFlowMeta:
      overrides.peekFlowMeta ??
      (async () => ({
        name: "Flow",
        target: "Android - Pixel 9 (Android 15)",
      })),
    resolveDepsRoot: async () => "/cwd",
  };
}

describe("installAndroid", () => {
  it("spawns the .bat and .cmd wrappers when the platform is win32", async () => {
    const ctx = makeCtx();
    const spawn = makeSpawn();
    const deps = {
      ...makeDeps({ spawn: spawn.fn }),
      platform: "win32" as const,
    };

    await installAndroid(ctx, undefined, deps);

    const spawned = spawn.calls.map((call) => call[0]);
    expect(spawned).toContain(
      join(sdk, "cmdline-tools", "latest", "bin", "sdkmanager.bat"),
    );
    expect(spawned).toContain(
      join(sdk, "cmdline-tools", "latest", "bin", "avdmanager.bat"),
    );
    expect(spawned).toContain(
      join("/cwd", "node_modules", ".bin", "appium.cmd"),
    );
  });

  it("should return void and log info when no Android flows are found", async () => {
    const ctx = makeCtx();
    const { fn: spawn, calls } = makeSpawn();
    const result = await installAndroid(ctx, undefined, {
      ...makeDeps({ spawn }),
      peekFlowMeta: async () => ({ name: "Flow", target: "Web - Chrome" }),
    });
    expect(result).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(
      "No Android flows found. Nothing to install.",
    );
    expect(calls).toHaveLength(0);
  });

  it("should call sdkmanager --version as the first spawn call", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAndroid(makeCtx(), undefined, makeDeps({ spawn }));
    expect(calls[0]).toEqual([
      sdkManagerPath,
      ["--version"],
      { platform: "linux" },
    ]);
  });

  it("should throw with path and install URL when sdkmanager --version returns non-zero", async () => {
    const { fn: spawn } = makeSpawn({
      "--version": { exitCode: 1, stdout: "", stderr: "not found" },
    });
    let caught: unknown;
    try {
      await installAndroid(makeCtx(), undefined, makeDeps({ spawn }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(sdkManagerPath);
    expect((caught as Error).message).toContain(
      "https://developer.android.com",
    );
  });

  it("should pass stdin y\\n × 20 to sdkmanager --licenses", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAndroid(makeCtx(), undefined, makeDeps({ spawn }));
    const licensesCall = calls.find(([, args]) => args[0] === "--licenses");
    expect(licensesCall?.[2]).toEqual({
      stdin: "y\n".repeat(20),
      platform: "linux",
    });
  });

  it("should install each unique system image exactly once when two files share the same preset", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAndroid(makeCtx(), undefined, {
      ...makeDeps({ spawn, arch: "arm64" }),
      expandPatterns: async () => ["/a.ts", "/b.ts"],
      peekFlowMeta: async () => ({
        name: "F",
        target: "Android - Pixel 9 (Android 15)",
      }),
    });
    const imageCalls = calls.filter(
      ([cmd, args]) =>
        cmd === sdkManagerPath && (args[0] ?? "").startsWith("system-images;"),
    );
    expect(imageCalls).toHaveLength(1);
    expect(imageCalls[0]?.[1][0]).toBe(
      "system-images;android-35;google_apis_playstore;arm64-v8a",
    );
  });

  it("should skip avdmanager create and log info when avd already exists", async () => {
    const { fn: spawn, calls } = makeSpawn({
      list: { exitCode: 0, stdout: "qawolf_pixel_9_api35\n", stderr: "" },
    });
    const ctx = makeCtx();
    await installAndroid(ctx, undefined, makeDeps({ spawn }));
    expect(calls.find(([, args]) => args[0] === "create")).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("qawolf_pixel_9_api35"),
    );
  });

  it("should create avd with correct name, system image, and device id", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAndroid(
      makeCtx(),
      undefined,
      makeDeps({ spawn, arch: "arm64" }),
    );
    const createCall = calls.find(([, args]) => args[0] === "create");
    expect(createCall?.[1]).toEqual([
      "create",
      "avd",
      "-n",
      "qawolf_pixel_9_api35",
      "-k",
      "system-images;android-35;google_apis_playstore;arm64-v8a",
      "-d",
      "pixel_9",
      "--force",
    ]);
  });

  it("should throw when avdmanager create returns non-zero", async () => {
    const { fn: spawn } = makeSpawn({
      create: {
        exitCode: 1,
        stdout: "",
        stderr: "avdmanager: error creating",
      },
    });
    let caught: unknown;
    try {
      await installAndroid(makeCtx(), undefined, makeDeps({ spawn }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(
      "avdmanager failed to create qawolf_pixel_9_api35",
    );
    expect((caught as Error).message).toContain("avdmanager: error creating");
  });

  it("should call appium driver install when uiautomator2 is absent", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAndroid(makeCtx(), undefined, makeDeps({ spawn }));
    expect(
      calls.some(
        ([cmd, args]) => cmd === appiumBinPath && args[1] === "install",
      ),
    ).toBe(true);
  });
});
