import { pathExists, rename } from "~/shell/fs.js";

import type { createTempPathRegistry } from "./safeRemove.js";
import { mintTempPath, removeTempDir } from "./safeRemove.js";

type TempPathRegistry = ReturnType<typeof createTempPathRegistry>;

export async function replaceAssetsDir(
  assetsAbs: string,
  tmpAssets: string,
  registry: TempPathRegistry,
): Promise<void> {
  let oldAssets: string | undefined;
  try {
    if (await pathExists(assetsAbs)) {
      oldAssets = mintTempPath(assetsAbs, "old", registry);
      await rename(assetsAbs, oldAssets);
    }
    await rename(tmpAssets, assetsAbs);
  } catch (err) {
    if (oldAssets !== undefined) {
      await rename(oldAssets, assetsAbs).catch(() => {});
    }
    throw err;
  }

  if (oldAssets !== undefined) {
    await cleanupTempDir(oldAssets, registry);
  }
}

export async function cleanupTempDir(
  absPath: string,
  registry: TempPathRegistry,
): Promise<void> {
  await removeTempDir(absPath, registry).catch(() => {});
}
