import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unlink } from "~/shell/fs.js";
import { createTrpcClient } from "./createTrpcClient.js";
import {
  describeBundleDownloadError,
  describeRequestError,
} from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import { getIdentity, type IdentityResponse } from "./getIdentity.js";
import { sleep as defaultSleep } from "~/core/sleep.js";
import { type PlatformResult, requestWithRetry } from "./requestWithRetry.js";
import {
  environmentWithVariablesResponseSchema,
  flowsBundleResponseSchema,
} from "./types.js";

export type PlatformClient = {
  getIdentity: () => Promise<PlatformResult<IdentityResponse>>;
  getFlowsBundleUrl: (
    envId: string,
  ) => Promise<PlatformResult<{ signedUrl: string }>>;
  getEnvVars: (
    envId: string,
  ) => Promise<PlatformResult<Record<string, string>>>;
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
  const sleep = deps.sleep ?? defaultSleep;

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
      for (let attempt = 0; ; attempt++) {
        const result = await getIdentity(apiKey, deps);
        if (result.ok) return { ok: true, value: result.data };
        if ("status" in result) {
          if (result.status === 401 || result.status === 403) {
            return { ok: false, error: "API key is invalid or unauthorized" };
          }
          return {
            ok: false,
            error: `Could not verify API key: ${result.error}`,
          };
        }
        // Network error — retry if budget remains.
        const backoff = requestBackoffMs[attempt];
        if (backoff === undefined) {
          return {
            ok: false,
            error: `Could not verify API key: ${result.error}`,
          };
        }
        await sleep(backoff);
      }
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
