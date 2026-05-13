import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTrpcClient } from "~/apex/createTrpcClient.js";
import { fetchSignedUrl } from "~/apex/fetchSignedUrl.js";
import { flowsBundleResponseSchema } from "~/apex/types.js";
import { readManifest } from "./manifest.js";
import { promptOverwriteIfModified } from "./safety.js";
import {
  describeBundleDownloadError,
  describeBundleRequestError,
} from "./wireErrors.js";

const envIdPattern =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[a-z][a-z0-9-]{0,62}[a-z0-9])$/;

type ValidateEnvIdResult = "ok" | { error: string };

export function validateEnvId(envId: string): ValidateEnvIdResult {
  if (!envIdPattern.test(envId)) {
    return {
      error: `--env must be a UUID or kebab-case slug (got: ${envId})`,
    };
  }
  return "ok";
}

type RequestBundleDeps = {
  apiKey: string;
  baseUrl: string;
  fetch: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
};

// Backoff schedule for transient network errors only (HTTP/parse errors
// don't retry). Array length = retry budget; final attempt has no backoff.
const requestBundleBackoffMs = [500, 1500];

export async function requestBundle(
  deps: RequestBundleDeps,
  envId: string,
): Promise<{ signedUrl: string }> {
  const trpcClient = createTrpcClient(deps.apiKey, {
    baseUrl: deps.baseUrl,
    fetch: deps.fetch,
  });
  const sleep =
    deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));

  for (let attempt = 0; attempt <= requestBundleBackoffMs.length; attempt++) {
    const result = await trpcClient.mutation(
      "gitwolf.getFlowsBundleUrl",
      { envId },
      flowsBundleResponseSchema,
    );
    if (result.ok) return { signedUrl: result.data.url };

    const backoff = requestBundleBackoffMs[attempt];
    const retryable = result.error.kind === "network";
    if (backoff === undefined || !retryable) {
      throw new Error(describeBundleRequestError(result.error, deps.baseUrl));
    }
    await sleep(backoff);
  }
  throw new Error("internal: requestBundle retry loop exited unexpectedly");
}

type DownloadBundleDeps = {
  fetch: typeof globalThis.fetch;
};

export async function downloadBundle(
  deps: DownloadBundleDeps,
  signedUrl: string,
): Promise<{ tmpArchive: string }> {
  const tmpArchive = join(
    tmpdir(),
    `qawolf-pull-${randomBytes(8).toString("hex")}.tar.gz`,
  );
  const result = await fetchSignedUrl(
    { url: signedUrl, dest: tmpArchive },
    { fetch: deps.fetch },
  );
  if (!result.ok) {
    await unlink(tmpArchive).catch(() => {});
    throw new Error(describeBundleDownloadError(result.error));
  }
  return { tmpArchive };
}

type CheckSafetyArgs = {
  envDir: string;
  yes: boolean;
  interactive?: boolean | undefined;
  log: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

export async function checkSafety(
  args: CheckSafetyArgs,
): Promise<"proceed" | "abort" | "needs-yes"> {
  const existing = await readManifest(args.envDir);
  if (existing === "missing") return "proceed";
  if (existing === "malformed") {
    args.log(
      "Existing .manifest.json is unreadable; proceeding without local-modification check.",
    );
    return "proceed";
  }
  return promptOverwriteIfModified({ ...args, manifest: existing });
}
