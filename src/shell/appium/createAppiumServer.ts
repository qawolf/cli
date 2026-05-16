import { spawn } from "node:child_process";
import net from "node:net";
import { join } from "node:path";
import { PassThrough } from "node:stream";

import envPaths from "env-paths";

import { resolveAppiumBin } from "./resolveAppiumBin.js";

const readyBanner = "Appium REST http interface listener started on";
const defaultStartTimeoutMs = 30_000;
const bannerBufferMaxBytes = 1024;

export type AppiumProcess = {
  output: NodeJS.ReadableStream;
  kill: () => void;
  exitCode: Promise<number>;
};
export type SpawnAppiumFn = (
  bin: string,
  args: string[],
  env: Record<string, string | undefined>,
) => AppiumProcess;
export type FindFreePortFn = () => Promise<number>;
const findFreePort: FindFreePortFn = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", reject);
  });
const defaultSpawnAppium: SpawnAppiumFn = (bin, args, env) => {
  const child = spawn(bin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  const output = new PassThrough();
  child.stdout?.pipe(output, { end: false });
  child.stderr?.pipe(output, { end: false });
  const exitCode = new Promise<number>((resolve, reject) => {
    child.on("error", (err: Error) =>
      reject(new Error(`Failed to spawn Appium: ${err.message}`)),
    );
    child.on("close", (code, signal) => {
      if (code !== null) resolve(code);
      else
        reject(
          new Error(`Appium process killed by signal ${signal ?? "unknown"}`),
        );
    });
  });
  return { output, kill: () => child.kill(), exitCode };
};

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
  params?: {
    deps?: {
      spawn?: SpawnAppiumFn;
      findFreePort?: FindFreePortFn;
      resolveAppiumBin?: (envDir: string) => string;
    };
    options?: {
      appiumHome?: string;
      startTimeoutMs?: number;
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
  const resolveAppiumBinFn = params?.deps?.resolveAppiumBin ?? resolveAppiumBin;
  const appiumHome =
    params?.options?.appiumHome ?? join(envPaths("qawolf").data, "appium");
  const timeoutMs = params?.options?.startTimeoutMs ?? defaultStartTimeoutMs;
  const bin = resolveAppiumBinFn(envDir);
  const port = await findFreePortFn();
  const proc = spawnFn(bin, ["--port", String(port), "--log-level", "info"], {
    ...process.env,
    APPIUM_HOME: appiumHome,
  });
  await waitForBanner(proc.output, proc.exitCode, timeoutMs).catch(
    (err: unknown) => {
      proc.kill();
      throw err;
    },
  );
  let stopped = false;
  return {
    port,
    home: appiumHome,
    exited: proc.exitCode,
    stop: () => {
      if (stopped) return;
      stopped = true;
      proc.kill();
    },
  };
}
