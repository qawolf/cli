import { join } from "node:path";

import { pathExists } from "~/shell/fs.js";
import type { TeamStorageFile } from "./types.js";

export type ReusableAssetFile = {
  file: TeamStorageFile;
  relativePath: string;
};

export async function reusableAssetPaths(
  assetsAbs: string,
  safeFiles: readonly ReusableAssetFile[],
  manifest: Map<string, { etag?: string | undefined }>,
): Promise<Set<string>> {
  const reusable = new Set<string>();
  for (const { file, relativePath } of safeFiles) {
    if (await canReuseAsset(assetsAbs, relativePath, file, manifest)) {
      reusable.add(relativePath);
    }
  }
  return reusable;
}

async function canReuseAsset(
  assetsAbs: string,
  relativePath: string,
  file: TeamStorageFile,
  manifest: Map<string, { etag?: string | undefined }>,
): Promise<boolean> {
  if (file.etag === undefined) return false;
  const previous = manifest.get(relativePath);
  if (previous?.etag !== file.etag) return false;
  return pathExists(join(assetsAbs, relativePath));
}
