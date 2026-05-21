import { createTrpcClient } from "~/shell/platform/createTrpcClient.js";
import { requestWithRetry } from "~/shell/platform/requestWithRetry.js";
import {
  type TeamStorageFile,
  teamStorageListResponseSchema,
} from "~/shell/platform/types.js";
import {
  downloadTeamStorageAssets,
  type DownloadTeamStorageAssetsResult,
} from "./assetDownloader.js";
export {
  downloadTeamStorageAssets,
  type DownloadTeamStorageAssetsResult,
} from "./assetDownloader.js";
import { describeTeamStorageRequestError } from "./wireErrors.js";

type RequestTeamStorageFilesDeps = {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
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
