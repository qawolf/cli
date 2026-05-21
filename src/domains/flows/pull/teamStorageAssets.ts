import { mkdir } from "~/shell/fs.js";
import { dirname, join } from "node:path";

import { createTrpcClient } from "~/shell/platform/createTrpcClient.js";
import { fetchSignedUrl } from "~/shell/platform/fetchSignedUrl.js";
import { requestWithRetry } from "~/shell/platform/requestWithRetry.js";
import {
  type TeamStorageFile,
  teamStorageListResponseSchema,
} from "~/shell/platform/types.js";
import {
  describeTeamStorageDownloadError,
  describeTeamStorageRequestError,
} from "./wireErrors.js";
import { cleanupTempDir, replaceAssetsDir } from "./assetSnapshot.js";
import { createTempPathRegistry, mintTempPath } from "./safeRemove.js";
import { safeAssetPath } from "./safeAssetPath.js";

type RequestTeamStorageFilesDeps = {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
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
  teamId: string;
};

const requestBackoffMs = [500, 1500];

const excludePrefixes = ["_screenshots_/"];

export async function requestTeamStorageFiles(
  deps: RequestTeamStorageFilesDeps,
  teamId: string,
): Promise<TeamStorageFile[]> {
  const client = createTrpcClient(deps.apiKey, {
    baseUrl: deps.baseUrl,
    fetch: deps.fetch,
  });
  const files: TeamStorageFile[] = [];
  let nextPageToken: string | undefined;

  do {
    const input =
      nextPageToken === undefined
        ? { teamId, excludePrefixes }
        : { teamId, excludePrefixes, nextPageToken };
    const page = await requestWithRetry({
      call: () =>
        client.query(
          "team.listStorageFiles",
          input,
          teamStorageListResponseSchema,
        ),
      backoffMs: requestBackoffMs,
      describe: (err) => describeTeamStorageRequestError(err, deps.baseUrl),
      sleep: deps.sleep,
    });
    files.push(...page.files);
    nextPageToken = page.nextPageToken;
  } while (nextPageToken !== undefined);

  return files;
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
  deps: RequestTeamStorageFilesDeps,
): Promise<DownloadTeamStorageAssetsResult> {
  const files = await requestTeamStorageFiles(deps, args.teamId);
  return downloadTeamStorageAssets(
    { assetsAbs: args.assetsAbs, files },
    { fetch: deps.fetch },
  );
}
