import { mkdir } from "~/shell/fs.js";
import { dirname, join } from "node:path";

import { fetchSignedUrl } from "~/shell/platform/fetchSignedUrl.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { TeamStorageFile } from "~/shell/platform/types.js";
import { cleanupTempDir, replaceAssetsDir } from "./assetSnapshot.js";
import { createTempPathRegistry, mintTempPath } from "./safeRemove.js";
import { safeAssetPath } from "./safeAssetPath.js";
import { describeTeamStorageDownloadError } from "./wireErrors.js";

type RequestTeamStorageFilesDeps = {
  platform: PlatformClient;
};

type DownloadTeamStorageAssetsArgs = {
  assetsAbs: string;
  files: readonly TeamStorageFile[];
};

type DownloadTeamStorageAssetsResult = {
  downloadedCount: number;
  skippedCount: number;
};

type DownloadTeamStorageAssetsDeps = {
  fetch: typeof globalThis.fetch;
};

type SyncTeamStorageAssetsArgs = {
  assetsAbs: string;
};

export async function requestTeamStorageFiles(
  deps: RequestTeamStorageFilesDeps,
): Promise<TeamStorageFile[]> {
  const result = await deps.platform.listTeamStorageFiles();
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

export async function downloadTeamStorageAssets(
  args: DownloadTeamStorageAssetsArgs,
  deps: DownloadTeamStorageAssetsDeps = { fetch: globalThis.fetch },
): Promise<DownloadTeamStorageAssetsResult> {
  const registry = createTempPathRegistry();
  const tmpAssets = mintTempPath(args.assetsAbs, "pull", registry);
  let downloadedCount = 0;
  let skippedCount = 0;

  try {
    await mkdir(tmpAssets, { recursive: true });

    for (const file of args.files) {
      const relativePath = safeAssetPath(file.path);
      if (relativePath === undefined) {
        skippedCount++;
        continue;
      }

      const dest = join(tmpAssets, relativePath);
      await mkdir(dirname(dest), { recursive: true });
      const result = await fetchSignedUrl(
        { url: file.signedUrl, dest },
        { fetch: deps.fetch },
      );
      if (!result.ok) {
        throw new Error(
          describeTeamStorageDownloadError(file.path, result.error),
        );
      }
      downloadedCount++;
    }

    await replaceAssetsDir(args.assetsAbs, tmpAssets, registry);
    return { downloadedCount, skippedCount };
  } catch (err) {
    await cleanupTempDir(tmpAssets, registry);
    throw err;
  }
}

export async function syncTeamStorageAssets(
  args: SyncTeamStorageAssetsArgs,
  deps: RequestTeamStorageFilesDeps & DownloadTeamStorageAssetsDeps,
): Promise<DownloadTeamStorageAssetsResult> {
  const files = await requestTeamStorageFiles(deps);
  return downloadTeamStorageAssets(
    { assetsAbs: args.assetsAbs, files },
    { fetch: deps.fetch },
  );
}
