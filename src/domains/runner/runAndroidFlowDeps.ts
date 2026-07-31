import { createAppiumServer } from "~/shell/appium/createAppiumServer.js";
import { createEmulatorPool } from "~/shell/appium/createEmulatorPool.js";
import { defaultAdb } from "~/shell/appium/adb.js";
import type { AppiumDriver } from "~/shell/appium/types.js";
import { androidSdkHome } from "~/shell/androidSdkHome.js";
import type { RunAndroidFlowDeps } from "./runAndroidFlow.js";
import { createRunnerDeps } from "./runnerDeps.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

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

/**
 * Creates Android runner deps and lifecycle hooks for a flow run.
 *
 * The Appium server starts lazily on the first `boot()` call so web-only
 * runs incur no overhead. `shutdown()` is idempotent.
 */
export function createAndroidDeps(
  envDir: string,
  signals: SignalRegistry,
): {
  deps: RunAndroidFlowDeps;
  boot: (avdNames: string[]) => Promise<void>;
  shutdown: () => void;
} {
  const pool = createEmulatorPool({ signals, deps: { adb: defaultAdb } });
  // Mutable placeholder populated by boot() before any flow dispatches.
  const serverHandle = { port: 0, home: "", stop: () => {} };
  let serverStarted = false;

  const deps: RunAndroidFlowDeps = {
    ...createRunnerDeps(signals, envDir),
    appiumServer: serverHandle,
    emulatorPool: pool,
    createSession,
    adb: defaultAdb,
  };

  const boot = async (avdNames: string[]) => {
    if (!androidSdkHome()) {
      throw new Error(
        "ANDROID_HOME is not set. Set it to the Android SDK path.\n" +
          "Install Android Studio and open Tools > SDK Manager.",
      );
    }
    if (!serverStarted) {
      const server = await createAppiumServer(envDir, signals);
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
