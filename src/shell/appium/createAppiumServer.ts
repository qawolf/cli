import { join } from "node:path";

import envPaths from "env-paths";

import { existsSync } from "node:fs";

import { appiumCliCandidates } from "~/core/appiumBins.js";
import { installMessages } from "~/core/messages/index.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";
import { defaultSpawnAppium, findFreePort } from "./spawnAppium.js";

export type AppiumProcess = {
  output: NodeJS.ReadableStream;
  kill: () => void;
  exitCode: Promise<number>;
};
export type SpawnAppiumFn = (
  bin: string,
  args: string[],
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
) => AppiumProcess;
export type FindFreePortFn = () => Promise<number>;

const readyBanner = "Appium REST http interface listener started on";
const defaultStartTimeoutMs = 30_000;
const bannerBufferMaxBytes = 1024;

function waitForBanner(
  output: NodeJS.ReadableStream,
  exitCode: Promise<number>,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    function cleanup() {
      done = true;
      clearTimeout(timer);
      output.off("data", onData);
    }
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      if (done) return;
      buffer += String(chunk);
      if (buffer.length > bannerBufferMaxBytes) {
        buffer = buffer.slice(buffer.length - bannerBufferMaxBytes);
      }
      if (buffer.includes(readyBanner)) {
        cleanup();
        output.resume();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Appium server did not start within ${timeoutMs / 1_000}s`),
      );
    }, timeoutMs);
    output.on("data", onData);
    const fail = (err: unknown) => {
      if (done) return;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    void exitCode.then(
      (code) =>
        fail(new Error(`Appium process exited unexpectedly with code ${code}`)),
      fail,
    );
  });
}

export async function createAppiumServer(
  envDir: string,
  signals: SignalRegistry,
  params?: {
    deps?: {
      spawn?: SpawnAppiumFn;
      findFreePort?: FindFreePortFn;
      checkExists?: (path: string) => boolean;
    };
    options?: {
      appiumHome?: string;
      startTimeoutMs?: number;
      platform?: NodeJS.Platform;
    };
  },
): Promise<{
  port: number;
  home: string;
  stop: () => void;
  exited: Promise<number>;
}> {
  const spawnFn = params?.deps?.spawn ?? defaultSpawnAppium;
  const findFreePortFn = params?.deps?.findFreePort ?? findFreePort;
  const checkExists = params?.deps?.checkExists ?? existsSync;
  const appiumHome =
    params?.options?.appiumHome ?? join(envPaths("qawolf").data, "appium");
  const timeoutMs = params?.options?.startTimeoutMs ?? defaultStartTimeoutMs;
  const platform = params?.options?.platform ?? process.platform;
  const candidates = appiumCliCandidates(envDir, platform);
  const bin = candidates.find(checkExists);
  if (!bin) {
    throw new Error(
      installMessages.android.appiumNotFound(candidates[0] ?? envDir),
    );
  }
  const port = await findFreePortFn();
  const proc = spawnFn(
    bin,
    ["--port", String(port), "--log-level", "info"],
    platform,
    { ...process.env, APPIUM_HOME: appiumHome },
  );
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    proc.kill();
  };
  const unregister = signals.register(stop);
  await waitForBanner(proc.output, proc.exitCode, timeoutMs).catch(
    (err: unknown) => {
      unregister();
      stop();
      throw err;
    },
  );
  return {
    port,
    home: appiumHome,
    exited: proc.exitCode,
    stop: () => {
      unregister();
      stop();
    },
  };
}
