import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn } from "~/shell/spawn.js";

import { checkAndroid } from "./android.js";
import {
  appiumBin,
  baseDeps,
  findResult,
  sdk,
  success,
} from "./android.fixtures.js";

afterEach(() => {
  mock.restore();
});

describe("checkAndroid: appium and uiautomator2-driver", () => {
  it("warns for both when envDir is undefined", async () => {
    const results = await checkAndroid(baseDeps({ envDir: undefined }));
    const appium = findResult(results, "appium");
    const driver = findResult(results, "uiautomator2-driver");
    expect(appium?.status).toBe("warn");
    expect(appium?.detail).toBe(
      "Appium is not installed.\n" +
        "Run `qawolf install` to install the runtime dependencies.",
    );
    expect(driver?.status).toBe("warn");
  });

  it("warns when the Appium binary doesn't exist", async () => {
    const checkExists = mock<(path: string) => boolean>((p) => p === sdk);
    const results = await checkAndroid(baseDeps({ checkExists }));
    const appium = findResult(results, "appium");
    expect(appium?.status).toBe("warn");
    expect(appium?.detail).toBe(
      `Appium not found at ${appiumBin}.\n` +
        "Run `qawolf install` to install the runtime dependencies.",
    );
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

  it("warns uiautomator2-driver with an Appium-failure message when the driver list cannot launch", async () => {
    const spawn = mock<SpawnFn>((cmd, args) => {
      if (cmd === appiumBin && args[0] === "driver") {
        return Promise.resolve({
          exitCode: -1,
          stdout: "",
          stderr: "ENOENT: appium binary corrupt",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const driver = findResult(results, "uiautomator2-driver");
    expect(driver?.status).toBe("warn");
    expect(driver?.detail).toContain("appium driver list");
    expect(driver?.detail).toContain("ENOENT");
    // Must NOT recommend `qawolf install android` since Appium itself is broken.
    expect(driver?.detail).not.toContain("qawolf install android");
    expect(driver?.detail).toContain("Run `qawolf install clear`, then retry.");
    expect(driver?.detail).not.toContain("qawolf flows run");
  });

  it("warns uiautomator2-driver with an Appium-failure message when the driver list exits non-zero", async () => {
    const spawn = mock<SpawnFn>((cmd, args) => {
      if (cmd === appiumBin && args[0] === "driver") {
        return Promise.resolve({
          exitCode: 1,
          stdout: "",
          stderr: "Unknown command\n",
        });
      }
      return Promise.resolve(success);
    });
    const results = await checkAndroid(baseDeps({ spawn }));
    const driver = findResult(results, "uiautomator2-driver");
    expect(driver?.status).toBe("warn");
    expect(driver?.detail).toContain("appium driver list");
    expect(driver?.detail).toContain("Unknown command");
    expect(driver?.detail).not.toContain("qawolf install android");
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
