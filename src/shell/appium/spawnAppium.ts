import { spawn, type SpawnOptions } from "node:child_process";
import net from "node:net";
import { PassThrough } from "node:stream";

import { buildSpawnOptions } from "~/shell/spawn.js";
import type {
  AppiumProcess,
  FindFreePortFn,
  SpawnAppiumFn,
} from "./createAppiumServer.js";

export const findFreePort: FindFreePortFn = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", reject);
  });

export function buildAppiumSpawnOptions(
  bin: string,
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): SpawnOptions {
  return {
    stdio: ["ignore", "pipe", "pipe"],
    ...buildSpawnOptions(bin, platform, env),
  };
}

export const defaultSpawnAppium: SpawnAppiumFn = (bin, args, env) => {
  const child = spawn(
    bin,
    args,
    buildAppiumSpawnOptions(bin, process.platform, env),
  );
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
  return { output, kill: () => child.kill(), exitCode } satisfies AppiumProcess;
};
