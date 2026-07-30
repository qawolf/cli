import { spawn, type SpawnOptions } from "node:child_process";
import net from "node:net";
import { PassThrough } from "node:stream";

import { buildSpawnCommand } from "~/shell/spawn.js";
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

export function buildAppiumSpawn(
  bin: string,
  args: string[],
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
): { cmd: string; args: string[]; options: SpawnOptions } {
  const built = buildSpawnCommand(bin, args, platform, env);
  return {
    ...built,
    options: { stdio: ["ignore", "pipe", "pipe"], ...built.options },
  };
}

export const defaultSpawnAppium: SpawnAppiumFn = (bin, args, platform, env) => {
  const built = buildAppiumSpawn(bin, args, platform, env);
  const child = spawn(built.cmd, built.args, built.options);
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
