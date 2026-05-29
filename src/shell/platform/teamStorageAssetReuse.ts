import { join } from "node:path";

import type { Fs } from "~/shell/fs.js";
import type { TeamStorageFile } from "./types.js";

export type ReusableAssetFile = {
  file: TeamStorageFile;
  relativePath: string;
};

export async function reusableAssetPaths(
  assetsAbs: string,
  safeFiles: readonly ReusableAssetFile[],
  manifest: Map<string, { etag?: string | undefined }>,
  fs: Fs,
): Promise<Set<string>> {
  const reusable = new Set<string>();
  for (const { file, relativePath } of safeFiles) {
    if (await canReuseAsset(assetsAbs, relativePath, file, manifest, fs)) {
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
  fs: Fs,
): Promise<boolean> {
  if (file.etag === undefined) return false;
  const previous = manifest.get(relativePath);
  if (previous?.etag !== file.etag) return false;
  return fs.pathExists(join(assetsAbs, relativePath));
}
