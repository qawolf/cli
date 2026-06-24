import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { spawnNpmInstall, type SpawnInstallResult } from "./npmInstall.js";
import { scaffoldManagedEnv } from "./managedEnvDir.js";
import { allPinnedResolved } from "./resolvePinned.js";
import { shimFlowsDeps } from "./shimDeps.js";

type SpawnInstallFn = (cwd: string) => Promise<SpawnInstallResult>;

export type InstallPinnedDeps = { fs: Fs; spawnInstall: SpawnInstallFn };

export const defaultSpawnInstall = spawnNpmInstall;

export async function installPinned(
  targetDir: string,
  deps: InstallPinnedDeps = {
    fs: makeDefaultFs(),
    spawnInstall: defaultSpawnInstall,
  },
): Promise<void> {
  // Short-circuit: another process or a previous run already completed the install.
  if (allPinnedResolved(targetDir, deps.fs)) {
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
    const anotherShardWon = allPinnedResolved(targetDir, deps.fs);
    if (anotherShardWon) {
      await deps.fs.rm(tempDir, { recursive: true, force: true });
      return;
    }
    throw err;
  }
}
