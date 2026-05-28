import type { TrpcClient } from "./createTrpcClient.js";
import { describeRequestError } from "./describeErrors.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";
import {
  type TeamStorageFile,
  teamStorageListResponseSchema,
} from "./types.js";

type Deps = {
  baseUrl: string;
  sleep?: (ms: number) => Promise<void>;
};

const requestBackoffMs = [500, 1500] as const;
const excludePrefixes = ["_screenshots_/"];

export async function listTeamStorageFiles(
  trpc: TrpcClient,
  args: { teamId: string },
  deps: Deps,
): Promise<PlatformResult<TeamStorageFile[]>> {
  const files: TeamStorageFile[] = [];
  let nextPageToken: string | undefined;
  do {
    const input =
      nextPageToken === undefined
        ? { teamId: args.teamId, excludePrefixes }
        : { teamId: args.teamId, excludePrefixes, pageToken: nextPageToken };
    const result = await requestWithRetry({
      call: () =>
        trpc.query(
          "team.listStorageFiles",
          input,
          teamStorageListResponseSchema,
        ),
      backoffMs: requestBackoffMs,
      describe: (err) =>
        describeRequestError(err, deps.baseUrl, "team-storage assets"),
      sleep: deps.sleep,
    });
    if (!result.ok) return result;
    files.push(...result.value.files);
    nextPageToken = result.value.nextPageToken;
  } while (nextPageToken !== undefined);

  return { ok: true, value: files };
}
