import { mkdir } from "~/shell/fs.js";
import { dirname, join, normalize, sep } from "node:path";

import { fetchSignedUrl } from "~/shell/platform/fetchSignedUrl.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";
import type { TeamStorageFile } from "~/shell/platform/types.js";
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
  let downloadedCount = 0;
  let skippedCount = 0;

  for (const file of args.files) {
    const relativePath = safeAssetPath(file.path);
    if (relativePath === undefined) {
      skippedCount++;
      continue;
    }

    const dest = join(args.assetsAbs, relativePath);
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

  return { downloadedCount, skippedCount };
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

function safeAssetPath(path: string): string | undefined {
  if (!path || path.endsWith("/") || path.includes("\\")) return undefined;

  const segments = path.split("/");
  if (
    segments.some((segment) => {
      const normalized = segment.toLowerCase();
      return (
        segment === "" ||
        segment === "." ||
        segment === ".." ||
        normalized === "_screenshots_" ||
        normalized === "screenshots" ||
        normalized === "ovpn" ||
        normalized.endsWith(".ovpn")
      );
    })
  ) {
    return undefined;
  }

  const normalized = normalize(path);
  if (normalized.startsWith(`..${sep}`) || normalized === "..") {
    return undefined;
  }
  return normalized;
}
