import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { createTrpcClient } from "./createTrpcClient.js";
import {
  describeIdentityError,
  describeRequestError,
} from "./describeErrors.js";
import { downloadBundle } from "./downloadBundle.js";
import { getIdentity, type IdentityResponse } from "./getIdentity.js";
import { getRemoteFlows, type RemoteFlowsResponse } from "./getRemoteFlows.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";
import { listTeamStorageFiles } from "./teamStorage.js";
import {
  downloadTeamStorageAssets,
  type SyncTeamStorageAssetsResult,
} from "./teamStorageAssets.js";
import {
  environmentWithVariablesResponseSchema,
  flowsBundleResponseSchema,
  type TeamStorageFile,
} from "./types.js";

export type PlatformClient = {
  getIdentity: () => Promise<PlatformResult<IdentityResponse>>;
  getRemoteFlows: () => Promise<PlatformResult<RemoteFlowsResponse>>;
  getFlowsBundleUrl: (
    envId: string,
  ) => Promise<PlatformResult<{ signedUrl: string }>>;
  getEnvVars: (
    envId: string,
  ) => Promise<PlatformResult<Record<string, string>>>;
  listTeamStorageFiles: () => Promise<PlatformResult<TeamStorageFile[]>>;
  syncTeamStorageAssets: (
    assetsAbs: string,
  ) => Promise<PlatformResult<SyncTeamStorageAssetsResult>>;
  downloadBundle: (
    envId: string,
  ) => Promise<PlatformResult<{ tmpArchive: string }>>;
};

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  fs?: Fs | undefined;
  logger?: Logger;
  sleep?: (ms: number) => Promise<void>;
};

const requestBackoffMs = [500, 1500] as const;

export function createPlatformClient(
  apiKey: string,
  deps: Deps,
): PlatformClient {
  const trpc = createTrpcClient(apiKey, deps);
  const fs = deps.fs ?? makeDefaultFs();

  async function getFlowsBundleUrlImpl(
    envId: string,
  ): Promise<PlatformResult<{ signedUrl: string }>> {
    const result = await requestWithRetry({
      call: () =>
        // gitwolf is the platform's flows-bundle tRPC router.
        trpc.mutation(
          "gitwolf.getFlowsBundleUrl",
          { environmentId: envId },
          flowsBundleResponseSchema,
        ),
      backoffMs: requestBackoffMs,
      describe: (err) => describeRequestError(err, deps.baseUrl),
      sleep: deps.sleep,
    });
    if (!result.ok) return result;
    return { ok: true, value: { signedUrl: result.value.url } };
  }

  return {
    async getIdentity() {
      return requestWithRetry({
        call: () => getIdentity(apiKey, deps),
        backoffMs: requestBackoffMs,
        describe: describeIdentityError,
        sleep: deps.sleep,
      });
    },

    async getRemoteFlows() {
      return requestWithRetry({
        call: () => getRemoteFlows(apiKey, deps),
        backoffMs: requestBackoffMs,
        describe: (err) => describeRequestError(err, deps.baseUrl, "flows"),
        sleep: deps.sleep,
      });
    },

    getFlowsBundleUrl: getFlowsBundleUrlImpl,

    async getEnvVars(envId) {
      const result = await requestWithRetry({
        call: () =>
          trpc.query(
            "environment.getEnvironmentWithVariables",
            { id: envId },
            environmentWithVariablesResponseSchema,
          ),
        backoffMs: requestBackoffMs,
        describe: (err) => describeRequestError(err, deps.baseUrl, "env-vars"),
        sleep: deps.sleep,
      });
      if (!result.ok) return result;
      return { ok: true, value: result.value.environmentVariables };
    },

    async listTeamStorageFiles() {
      const identity = await this.getIdentity();
      if (!identity.ok) return identity;
      return listTeamStorageFiles(
        trpc,
        { teamId: identity.value.team.id },
        deps,
      );
    },

    async syncTeamStorageAssets(assetsAbs) {
      const files = await this.listTeamStorageFiles();
      if (!files.ok) return files;
      return downloadTeamStorageAssets(
        { assetsAbs, files: files.value },
        { fetch: deps.fetch, fs },
      );
    },

    async downloadBundle(envId) {
      const urlResult = await getFlowsBundleUrlImpl(envId);
      if (!urlResult.ok) return urlResult;
      return downloadBundle(urlResult.value.signedUrl, {
        fetch: deps.fetch,
        fs,
      });
    },
  };
}
