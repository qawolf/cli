import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { TeamStorageFile } from "~/shell/platform/types.js";
import {
  downloadTeamStorageAssets,
  type DownloadTeamStorageAssetsDeps,
  type DownloadTeamStorageAssetsResult,
} from "./assetDownloader.js";
export {
  downloadTeamStorageAssets,
  type DownloadTeamStorageAssetsDeps,
  type DownloadTeamStorageAssetsResult,
} from "./assetDownloader.js";

type RequestTeamStorageFilesDeps = {
  platform: PlatformClient;
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
