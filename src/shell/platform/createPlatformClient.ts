import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import {
  type CallPublicApiMethod,
  makeCallPublicApiMethod,
} from "./callPublicApi.js";
import { createTrpcClient } from "./createTrpcClient.js";
import { describeRequestError } from "./describeErrors.js";
import { downloadBundle } from "./downloadBundle.js";
import { createIdentityMethods } from "./identityMethods.js";
import type { IdentityResponse } from "./getIdentity.js";
import type { Organization } from "./organizations.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";
import type { SyncTeamStorageAssetsResult } from "./teamStorageAssets.js";
import { createTeamStorageMethods } from "./teamStorageMethods.js";
import type { TeamStorageAssetProgress } from "./writeAssetSnapshot.js";
import {
  environmentWithVariablesResponseSchema,
  flowsBundleResponseSchema,
  type TeamStorageFile,
} from "./types.js";

export type PlatformClient = {
  callPublicApi: CallPublicApiMethod;
  getIdentity: () => Promise<PlatformResult<IdentityResponse>>;
  /** Every organization the caller may act on, including employee reach. */
  getAccessibleOrganizations: () => Promise<PlatformResult<Organization[]>>;
  getFlowsBundleUrl: (
    envId: string,
  ) => Promise<PlatformResult<{ signedUrl: string }>>;
  getEnvVars: (
    envId: string,
  ) => Promise<PlatformResult<Record<string, string>>>;
  listTeamStorageFiles: () => Promise<PlatformResult<TeamStorageFile[]>>;
  syncTeamStorageAssets: (
    assetsAbs: string,
    opts?: {
      onProgress?: (progress: TeamStorageAssetProgress) => void;
    },
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
  /** Workspace the session chose; public routes take it as an argument. */
  workspaceId?: string | undefined;
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

  const identityMethods = createIdentityMethods(apiKey, deps, requestBackoffMs);

  return {
    ...identityMethods,
    ...createTeamStorageMethods(trpc, deps, fs, identityMethods.getIdentity),

    getFlowsBundleUrl: getFlowsBundleUrlImpl,

    callPublicApi: makeCallPublicApiMethod(trpc, deps, requestBackoffMs),

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
