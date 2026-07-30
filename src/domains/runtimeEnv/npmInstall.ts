import type { SpawnOptions } from "node:child_process";

import { resolveNpmCommand } from "~/shell/npm.js";
import { buildSpawnCommand, spawn as nodeSpawn } from "~/shell/spawn.js";

export type SpawnInstallResult = { exitCode: number; stderr: string };

export type NpmSpawnFn = typeof nodeSpawn;

export function buildNpmInstallSpawn(
  cwd: string,
  platform: NodeJS.Platform,
): { cmd: string; args: string[]; options: SpawnOptions } {
  const built = buildSpawnCommand(
    resolveNpmCommand(platform),
    // npm 7+ strict peer-dep resolution rejects peerOptional conflicts — revert to npm 6 behaviour.
    ["install", "--legacy-peer-deps"],
    platform,
    undefined,
  );
  return { ...built, options: { ...built.options, cwd } };
}

/**
 * Runs `npm install --legacy-peer-deps` in the given directory and returns the
 * exit code and stderr. Uses the richer `stderr || err.message` fallback on
 * spawn error so callers always have diagnostic context.
 */
export function spawnNpmInstall(
  cwd: string,
  spawn: NpmSpawnFn = nodeSpawn,
): Promise<SpawnInstallResult> {
  return new Promise((resolve) => {
    const { cmd, args, options } = buildNpmInstallSpawn(cwd, process.platform);
    const child = spawn(cmd, args, options);
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
