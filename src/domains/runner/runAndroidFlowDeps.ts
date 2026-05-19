import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, unlink, writeFile } from "~/shell/fs.js";
import { spawn as nodeSpawn } from "~/shell/spawn.js";
import { createAppiumServer } from "~/shell/appium/createAppiumServer.js";
import { createEmulatorPool } from "~/shell/appium/createEmulatorPool.js";
import { defaultAdb } from "~/shell/appium/emulatorSetup.js";
import type { AppiumDriver } from "~/shell/appium/types.js";
import type { RunAndroidFlowDeps } from "./runAndroidFlow.js";

type WdioRemote = {
  startRecordingScreen(): Promise<void>;
  stopRecordingScreen(): Promise<string>;
  deleteSession(): Promise<void>;
};

async function createSession(
  port: number,
  serial: string,
): Promise<AppiumDriver> {
  // Dynamic import prevents the bundler from statically tracing webdriverio,
  // which has optional native deps that would break the binary build if inlined.
  const { remote } = (await import("webdriverio")) as unknown as {
    remote: (opts: Record<string, unknown>) => Promise<WdioRemote>;
  };
  const driver = await remote({
    hostname: "127.0.0.1",
    port,
    logLevel: "silent",
    capabilities: {
      platformName: "Android",
      "appium:udid": serial,
      "appium:automationName": "UiAutomator2",
      "appium:noReset": true,
    },
  });
  return {
    startRecordingScreen: () => driver.startRecordingScreen(),
    stopRecordingScreen: () => driver.stopRecordingScreen(),
    deleteSession: () => driver.deleteSession(),
  };
}

function makeRunnerDeps() {
  return {
    fs: {
      mkdir: async (p: string, opts?: { recursive?: boolean }) => {
        await mkdir(p, opts);
      },
      writeFile: async (p: string, d: string) => {
        await writeFile(p, d);
      },
      unlink: async (p: string) => {
        await unlink(p);
      },
    },
    spawn: (cmd: string, args: string[]) => {
      const child = nodeSpawn(cmd, args);
      return {
        exitCode: new Promise<number>((resolve) =>
          child.on("close", (code) => resolve(code ?? -1)),
        ),
        kill: () => {
          child.kill();
        },
      };
    },
    signals: {
      on: (signal: NodeJS.Signals, handler: () => void) => {
        process.on(signal, handler);
        return () => {
          process.off(signal, handler);
        };
      },
    },
    createStorage: <T>() => {
      const als = new AsyncLocalStorage<unknown>();
      return {
        run: async (store: T, callback: () => Promise<void>) =>
          als.run(store, callback),
        getStore: () => als.getStore() as T | undefined,
      };
    },
  };
}

/**
 * Creates Android runner deps and lifecycle hooks for a flow run.
 *
 * The Appium server starts lazily on the first `boot()` call so web-only
 * runs incur no overhead. `shutdown()` is idempotent.
 */
export function createAndroidDeps(envDir: string): {
  deps: RunAndroidFlowDeps;
  boot: (avdNames: string[]) => Promise<void>;
  shutdown: () => void;
} {
  const pool = createEmulatorPool({ deps: { adb: defaultAdb } });
  // Mutable placeholder populated by boot() before any flow dispatches.
  const serverHandle = { port: 0, home: "", stop: () => {} };
  let serverStarted = false;

  const deps: RunAndroidFlowDeps = {
    ...makeRunnerDeps(),
    appiumServer: serverHandle,
    emulatorPool: pool,
    createSession,
    adb: defaultAdb,
  };

  const boot = async (avdNames: string[]) => {
    const androidHome =
      process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"];
    if (!androidHome) {
      throw new Error(
        "ANDROID_HOME is not set. Set it to the Android SDK path.\n" +
          "Install Android Studio and open Tools > SDK Manager.",
      );
    }
    if (!serverStarted) {
      const server = await createAppiumServer(envDir);
      Object.assign(serverHandle, server);
      serverStarted = true;
    }
    await Promise.all(avdNames.map((name) => pool.bootForAvd(name, 1)));
  };

  const shutdown = () => {
    pool.closeAll();
    if (serverStarted) serverHandle.stop();
  };

  return { deps, boot, shutdown };
}
