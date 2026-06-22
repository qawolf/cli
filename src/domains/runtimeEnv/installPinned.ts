import { join } from "node:path";

import { type Fs, makeDefaultFs } from "~/shell/fs.js";
import { spawn as nodeSpawn } from "~/shell/spawn.js";

import { scaffoldManagedEnv } from "./managedEnvDir.js";
import { shimFlowsDeps } from "./shimDeps.js";

type SpawnInstallResult = { exitCode: number; stderr: string };

type SpawnInstallFn = (cwd: string) => Promise<SpawnInstallResult>;

export type InstallPinnedDeps = { fs: Fs; spawnInstall: SpawnInstallFn };

export function defaultSpawnInstall(cwd: string): Promise<SpawnInstallResult> {
  return new Promise((resolve) => {
    // npm 7+ strict peer-dep resolution rejects peerOptional conflicts — revert to npm 6 behaviour.
    const child = nodeSpawn("npm", ["install", "--legacy-peer-deps"], { cwd });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: -1, stderr }));
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stderr }));
  });
}

export async function installPinned(
  targetDir: string,
  deps: InstallPinnedDeps = {
    fs: makeDefaultFs(),
    spawnInstall: defaultSpawnInstall,
  },
): Promise<void> {
  // Short-circuit: another process or a previous run already completed the install.
  if (
    deps.fs.existsSync(join(targetDir, "node_modules", ".bin", "playwright"))
  ) {
    return;
  }

  // Use a PID-scoped temp dir so parallel CI shards don't collide.
  const tempDir = `${targetDir}.installing.${process.pid}`;

  // Clean any stale temp dir left by a previous crash.
  await deps.fs.rm(tempDir, { recursive: true, force: true });
  await scaffoldManagedEnv(tempDir, deps.fs);

  const result = await deps.spawnInstall(tempDir);
  if (result.exitCode !== 0) {
    await deps.fs.rm(tempDir, { recursive: true, force: true });
    throw new Error(
      `Failed to install managed runtime into ${targetDir}: ${result.stderr.trim()}`,
    );
  }

  await shimFlowsDeps(tempDir, deps.fs);

  // Atomic publish: the first shard to rename wins; others detect the completed
  // .bin/playwright shim and quietly remove their own temp dir.
  try {
    await deps.fs.rename(tempDir, targetDir);
  } catch (err) {
    const anotherShardWon = deps.fs.existsSync(
      join(targetDir, "node_modules", ".bin", "playwright"),
    );
    if (anotherShardWon) {
      await deps.fs.rm(tempDir, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}
