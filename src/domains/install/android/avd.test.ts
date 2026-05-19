import { afterEach, describe, expect, it, mock } from "bun:test";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { installAvds } from "./avd.js";

afterEach(() => {
  mock.restore();
});

const sdk = "/sdk";
const sdkManagerPath = `${sdk}/cmdline-tools/latest/bin/sdkmanager`;
const avdManagerPath = `${sdk}/cmdline-tools/latest/bin/avdmanager`;

const success: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };

const spec = {
  avdName: "qawolf_pixel_9_api35",
  systemImage: "system-images;android-35;google_apis_playstore;arm64-v8a",
  deviceId: "pixel_9",
};

function makeSpawn(overrides: Record<string, SpawnResult> = {}): {
  fn: SpawnFn;
  calls: [string, string[], ({ stdin?: string } | undefined)?][];
} {
  const calls: [string, string[], ({ stdin?: string } | undefined)?][] = [];
  const fn: SpawnFn = (cmd, args, opts) => {
    calls.push([cmd, args, opts]);
    return Promise.resolve(overrides[args[0] ?? cmd] ?? success);
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
    checkExists?: (path: string) => boolean;
  } = {},
) {
  return {
    spawn: overrides.spawn ?? makeSpawn().fn,
    sdkManagerPath,
    avdManagerPath,
    androidHome: sdk,
    checkExists: overrides.checkExists ?? (() => false),
  };
}

describe("installAvds", () => {
  it("should skip license acceptance when android-sdk-license file exists", async () => {
    const { fn: spawn, calls } = makeSpawn();
    const ctx = makeCtx();
    await installAvds(ctx, [spec], {
      ...makeDeps({ spawn }),
      checkExists: (p) => p.endsWith("android-sdk-license"),
    });
    expect(calls.find(([, args]) => args[0] === "--licenses")).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("already accepted"),
    );
  });

  it("should accept licenses when android-sdk-license file is absent", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAvds(makeCtx(), [spec], makeDeps({ spawn }));
    const licensesCall = calls.find(([, args]) => args[0] === "--licenses");
    expect(licensesCall?.[2]).toEqual({ stdin: "y\n".repeat(20) });
  });

  it("should skip system image install when image directory exists", async () => {
    const { fn: spawn, calls } = makeSpawn();
    const ctx = makeCtx();
    await installAvds(ctx, [spec], {
      ...makeDeps({ spawn }),
      checkExists: (p) => p.includes("system-images"),
    });
    const imageCalls = calls.filter(
      ([cmd, args]) =>
        cmd === sdkManagerPath && (args[0] ?? "").startsWith("system-images;"),
    );
    expect(imageCalls).toHaveLength(0);
    expect(ctx.ui.info).toHaveBeenCalledWith(
      expect.stringContaining("already installed"),
    );
  });

  it("should install system image when image directory is absent", async () => {
    const { fn: spawn, calls } = makeSpawn();
    await installAvds(makeCtx(), [spec], makeDeps({ spawn }));
    const imageCall = calls.find(
      ([cmd, args]) =>
        cmd === sdkManagerPath && (args[0] ?? "").startsWith("system-images;"),
    );
    expect(imageCall?.[1][0]).toBe(spec.systemImage);
  });
});
