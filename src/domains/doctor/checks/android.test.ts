import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import { checkAndroid } from "./android.js";

afterEach(() => {
  mock.restore();
});

const sdk = "/sdk";
const adbPath = `${sdk}/platform-tools/adb`;
const emulatorPath = `${sdk}/emulator/emulator`;
const envDir = "/proj";
const appiumBin = `${envDir}/node_modules/.bin/appium`;

const success: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };
const launchFail: SpawnResult = { exitCode: -1, stdout: "", stderr: "" };

function spawnRouter(
  routes: Record<string, SpawnResult>,
  fallback: SpawnResult = success,
): SpawnFn {
  return mock<SpawnFn>((cmd) => Promise.resolve(routes[cmd] ?? fallback));
}

function baseDeps(over: Partial<Parameters<typeof checkAndroid>[0]> = {}) {
  return {
    spawn: spawnRouter({}),
    androidHome: sdk,
    checkExists: mock<(path: string) => boolean>(() => true),
    envDir,
    resolveAppiumBin: (dir: string) => `${dir}/node_modules/.bin/appium`,
    requiredAvds: [] as readonly string[],
    ...over,
  };
}

function findResult(
  results: Awaited<ReturnType<typeof checkAndroid>>,
  name: string,
) {
  return results.find((r) => r.name === name);
}

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
    expect(spawn).toHaveBeenCalledWith(adbPath, ["--version"]);
  });

  it("invokes bare `adb` when ANDROID_HOME is missing", async () => {
    const spawn = spawnRouter({});
    await checkAndroid(baseDeps({ spawn, androidHome: undefined }));
    expect(spawn).toHaveBeenCalledWith("adb", ["--version"]);
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

  it("warns when emulator -list-avds fails to launch", async () => {
    const spawn = mock<SpawnFn>((_cmd, args) => {
      if (args[0] === "-list-avds") return Promise.resolve(launchFail);
      return Promise.resolve(success);
    });
    const results = await checkAndroid(
      baseDeps({ spawn, requiredAvds: ["qawolf_pixel_9_api35"] }),
    );
    const avd = findResult(results, "android-avd");
    expect(avd?.status).toBe("warn");
    expect(avd?.detail).toContain("Could not list AVDs");
  });
});

describe("checkAndroid: appium and uiautomator2-driver", () => {
  it("warns for both when envDir is undefined", async () => {
    const results = await checkAndroid(baseDeps({ envDir: undefined }));
    const appium = findResult(results, "appium");
    const driver = findResult(results, "uiautomator2-driver");
    expect(appium?.status).toBe("warn");
    expect(appium?.detail).toContain("qawolf flows run");
    expect(driver?.status).toBe("warn");
  });

  it("warns when the Appium binary doesn't exist", async () => {
    const checkExists = mock<(path: string) => boolean>((p) => p === sdk);
    const results = await checkAndroid(baseDeps({ checkExists }));
    const appium = findResult(results, "appium");
    expect(appium?.status).toBe("warn");
    expect(appium?.detail).toContain(appiumBin);
  });

  it("passes uiautomator2-driver when 'appium driver list' output mentions uiautomator2", async () => {
    const spawn = mock<SpawnFn>((cmd, args) => {
      if (cmd === appiumBin && args[0] === "driver") {
        return Promise.resolve({
          exitCode: 0,
          stdout: "",
          stderr: "- uiautomator2@3.7.0 [installed (NPM)]\n",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    expect(findResult(results, "uiautomator2-driver")?.status).toBe("pass");
  });

  it("warns uiautomator2-driver when the driver list doesn't mention it", async () => {
    const spawn = mock<SpawnFn>((cmd, args) => {
      if (cmd === appiumBin && args[0] === "driver") {
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const driver = findResult(results, "uiautomator2-driver");
    expect(driver?.status).toBe("warn");
    expect(driver?.detail).toContain("qawolf install android");
  });

  it("invokes appium driver list with APPIUM_HOME set to the shared qawolf data dir", async () => {
    const spawn = mock<SpawnFn>(() => Promise.resolve(success));
    await checkAndroid(baseDeps({ spawn }));
    const driverListCall = spawn.mock.calls.find(
      (c) => c[0] === appiumBin && c[1][0] === "driver",
    );
    expect(driverListCall).toBeDefined();
    const opts = driverListCall?.[2] as { env?: Record<string, string> };
    expect(opts?.env?.["APPIUM_HOME"]).toContain("appium");
  });
});
