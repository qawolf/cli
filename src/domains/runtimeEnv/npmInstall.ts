import type { SpawnOptions } from "node:child_process";

import { resolveNpmCommand } from "~/shell/npm.js";
import { buildSpawnOptions, spawn as nodeSpawn } from "~/shell/spawn.js";

export type SpawnInstallResult = { exitCode: number; stderr: string };

export function buildNpmInstallSpawn(
  cwd: string,
  platform: NodeJS.Platform,
): { cmd: string; args: string[]; options: SpawnOptions } {
  const cmd = resolveNpmCommand(platform);
  return {
    cmd,
    // npm 7+ strict peer-dep resolution rejects peerOptional conflicts — revert to npm 6 behaviour.
    args: ["install", "--legacy-peer-deps"],
    options: { ...buildSpawnOptions(cmd, platform, undefined), cwd },
  };
}

/**
 * Runs `npm install --legacy-peer-deps` in the given directory and returns the
 * exit code and stderr. Uses the richer `stderr || err.message` fallback on
 * spawn error so callers always have diagnostic context.
 */
export function spawnNpmInstall(cwd: string): Promise<SpawnInstallResult> {
  return new Promise((resolve) => {
    const { cmd, args, options } = buildNpmInstallSpawn(cwd, process.platform);
    const child = nodeSpawn(cmd, args, options);
    let stderr = "";
    // Drain stdout so a large install (playwright + appium) can't fill the pipe
    // buffer and stall npm; we only need the exit code and stderr.
    child.stdout?.resume();
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on("error", (err: Error) =>
      resolve({ exitCode: -1, stderr: stderr || err.message }),
    );
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}
