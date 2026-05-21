import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unlink } from "~/shell/fs.js";
import { createTrpcClient } from "./createTrpcClient.js";
import {
  describeBundleDownloadError,
  describeIdentityError,
  describeRequestError,
} from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import { getIdentity, type IdentityResponse } from "./getIdentity.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";
import { listTeamStorageFiles } from "./teamStorage.js";
import {
  environmentWithVariablesResponseSchema,
  flowsBundleResponseSchema,
  type TeamStorageFile,
} from "./types.js";

export type PlatformClient = {
  getIdentity: () => Promise<PlatformResult<IdentityResponse>>;
  getFlowsBundleUrl: (
    envId: string,
  ) => Promise<PlatformResult<{ signedUrl: string }>>;
  getEnvVars: (
    envId: string,
  ) => Promise<PlatformResult<Record<string, string>>>;
  listTeamStorageFiles: () => Promise<PlatformResult<TeamStorageFile[]>>;
  downloadBundle: (
    envId: string,
  ) => Promise<PlatformResult<{ tmpArchive: string }>>;
};

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  sleep?: (ms: number) => Promise<void>;
};

const requestBackoffMs = [500, 1500] as const;

export function createPlatformClient(
  apiKey: string,
  deps: Deps,
): PlatformClient {
  const trpc = createTrpcClient(apiKey, deps);

  async function getFlowsBundleUrlImpl(
    envId: string,
  ): Promise<PlatformResult<{ signedUrl: string }>> {
    const result = await requestWithRetry({
      call: () =>
        trpc.mutation(
          "gitwolf.getFlowsBundleUrl",
          { envId },
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

    async downloadBundle(envId) {
      const urlResult = await getFlowsBundleUrlImpl(envId);
      if (!urlResult.ok) return urlResult;

      const tmpArchive = join(
        tmpdir(),
        `qawolf-pull-${randomBytes(8).toString("hex")}.tar.gz`,
      );
      const result = await fetchSignedUrl(
        { url: urlResult.value.signedUrl, dest: tmpArchive },
        { fetch: deps.fetch },
      );
      if (!result.ok) {
        await unlink(tmpArchive).catch(() => {});
        return { ok: false, error: describeBundleDownloadError(result.error) };
      }
      return { ok: true, value: { tmpArchive } };
    },
  };
}
