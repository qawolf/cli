import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

import type { SpawnFn } from "~/shell/spawn.js";

import { checkAndroid } from "./android.js";
import {
  adbPath,
  baseDeps,
  emulatorPath,
  envDir,
  findResult,
  sdk,
  spawnRouter,
  success,
} from "./android.fixtures.js";

afterEach(() => {
  mock.restore();
});

describe("checkAndroid: android-home", () => {
  it("fails when ANDROID_HOME is undefined", async () => {
    const results = await checkAndroid(baseDeps({ androidHome: undefined }));
    const home = findResult(results, "android-home");
    expect(home?.status).toBe("fail");
    expect(home?.detail).toContain("ANDROID_HOME");
    expect(home?.detail).toContain("ANDROID_SDK_ROOT");
  });

  it("fails when ANDROID_HOME points at a non-existent dir", async () => {
    const results = await checkAndroid(
      baseDeps({ checkExists: mock(() => false) }),
    );
    const home = findResult(results, "android-home");
    expect(home?.status).toBe("fail");
    expect(home?.detail).toContain(sdk);
  });

  it("passes and reports the home path when the dir exists", async () => {
    const checkExists = mock<(path: string) => boolean>((p) => p === sdk);
    const results = await checkAndroid(baseDeps({ checkExists }));
    const home = findResult(results, "android-home");
    expect(home?.status).toBe("pass");
    expect(home?.detail).toBe(sdk);
  });
});

describe("checkAndroid: adb", () => {
  it("invokes adb at the SDK-relative path when ANDROID_HOME is set", async () => {
    const spawn = spawnRouter({});
    await checkAndroid(baseDeps({ spawn }));
    expect(spawn).toHaveBeenCalledWith(adbPath, ["--version"], {
      platform: "linux",
    });
  });

  it("invokes bare `adb` when ANDROID_HOME is missing", async () => {
    const spawn = spawnRouter({});
    await checkAndroid(baseDeps({ spawn, androidHome: undefined }));
    expect(spawn).toHaveBeenCalledWith("adb", ["--version"], {
      platform: "linux",
    });
  });

  it("fails when adb cannot launch, surfacing the spawn error and attempted path", async () => {
    const spawn = spawnRouter({
      [adbPath]: {
        exitCode: -1,
        stdout: "",
        stderr: "EACCES: permission denied",
      },
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const adb = findResult(results, "adb");
    expect(adb?.status).toBe("fail");
    expect(adb?.detail).toContain(adbPath);
    expect(adb?.detail).toContain("EACCES");
  });

  it("fails when adb exits non-zero", async () => {
    const spawn = spawnRouter({
      [adbPath]: { exitCode: 1, stdout: "", stderr: "boom\n" },
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const adb = findResult(results, "adb");
    expect(adb?.status).toBe("fail");
    expect(adb?.detail).toBe("boom");
  });
});

describe("checkAndroid: android-emulator", () => {
  it("fails when the emulator binary cannot launch, surfacing the spawn error and attempted path", async () => {
    const spawn = spawnRouter({
      [emulatorPath]: {
        exitCode: -1,
        stdout: "",
        stderr: "ENOENT: no such file or directory",
      },
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const emulator = findResult(results, "android-emulator");
    expect(emulator?.status).toBe("fail");
    expect(emulator?.detail).toContain(emulatorPath);
    expect(emulator?.detail).toContain("ENOENT");
  });

  it("passes when emulator -version exits 0", async () => {
    const results = await checkAndroid(baseDeps());
    expect(findResult(results, "android-emulator")?.status).toBe("pass");
  });
});

describe("checkAndroid: android-avd", () => {
  it("emits a single aggregated warn listing all missing AVDs", async () => {
    const spawn = mock<SpawnFn>((_cmd, args) => {
      if (args[0] === "-list-avds") {
        return Promise.resolve({
          exitCode: 0,
          stdout: "qawolf_pixel_9_api35\n",
          stderr: "",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(
      baseDeps({
        spawn,
        requiredAvds: ["qawolf_pixel_9_api35", "qawolf_pixel_tablet_api34"],
      }),
    );
    const avdWarns = results.filter((r) => r.name === "android-avd");
    expect(avdWarns).toHaveLength(1);
    expect(avdWarns[0]?.status).toBe("warn");
    expect(avdWarns[0]?.detail).toContain("qawolf_pixel_tablet_api34");
  });

  it("emits no avd results when requiredAvds is empty", async () => {
    const results = await checkAndroid(baseDeps());
    expect(results.filter((r) => r.name === "android-avd")).toHaveLength(0);
  });

  it("warns with a launch-failure message when emulator -list-avds cannot launch", async () => {
    const spawn = mock<SpawnFn>((_cmd, args) => {
      if (args[0] === "-list-avds") {
        return Promise.resolve({
          exitCode: -1,
          stdout: "",
          stderr: "ENOENT: emulator binary missing",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(
      baseDeps({ spawn, requiredAvds: ["qawolf_pixel_9_api35"] }),
    );
    const avd = findResult(results, "android-avd");
    expect(avd?.status).toBe("warn");
    expect(avd?.detail).toContain("Could not launch emulator");
    expect(avd?.detail).toContain(emulatorPath);
    expect(avd?.detail).toContain("ENOENT");
    // Distinct from the runtime-error branch — must not use that wording.
    expect(avd?.detail).not.toMatch(/^Could not list AVDs/);
  });

  it("warns with a runtime-error message when emulator -list-avds exits non-zero", async () => {
    const spawn = mock<SpawnFn>((_cmd, args) => {
      if (args[0] === "-list-avds") {
        return Promise.resolve({
          exitCode: 1,
          stdout: "",
          stderr: "PANIC: Broken AVD system path\n",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(
      baseDeps({ spawn, requiredAvds: ["qawolf_pixel_9_api35"] }),
    );
    const avd = findResult(results, "android-avd");
    expect(avd?.status).toBe("warn");
    expect(avd?.detail).toContain("Could not list AVDs");
    expect(avd?.detail).toContain("PANIC: Broken AVD system path");
    // Distinct from the launch-failure branch — must not use that wording.
    expect(avd?.detail).not.toContain("Could not launch emulator");
  });
});

describe("checkAndroid: Windows binary names", () => {
  it("launches adb.exe and emulator.exe on win32", async () => {
    const spawn = mock<SpawnFn>(() => Promise.resolve(success));
    await checkAndroid(
      baseDeps({ spawn, platform: "win32", requiredAvds: ["Pixel_9"] }),
    );
    const spawned = spawn.mock.calls.map((call) => call[0]);
    expect(spawned).toContain(join(sdk, "platform-tools", "adb.exe"));
    expect(spawned).toContain(join(sdk, "emulator", "emulator.exe"));
  });

  it("launches appium.cmd on win32", async () => {
    const spawn = mock<SpawnFn>(() => Promise.resolve(success));
    await checkAndroid(baseDeps({ spawn, platform: "win32" }));
    const spawned = spawn.mock.calls.map((call) => call[0]);
    expect(spawned).toContain(
      join(envDir, "node_modules", ".bin", "appium.cmd"),
    );
  });
});
