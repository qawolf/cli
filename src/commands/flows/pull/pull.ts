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
  // Optional injection seam so tests can skip the real backoff sleeps.
  sleep?: (ms: number) => Promise<void>;
};

// Back off between failures only on transient (network) errors. The
// cold-start case on a freshly-booted local platform is the typical
// retry-worthy scenario; HTTP 4xx/5xx and parse errors are not retried
// since re-running won't change the outcome. The array length is the
// retry budget: N entries = N+1 total attempts.
const requestBundleBackoffMs = [500, 1500];

export async function requestBundle(
  deps: RequestBundleDeps,
  envId: string,
): Promise<{ signedUrl: string }> {
  const trpcClient = createTrpcClient(deps.apiKey, {
    baseUrl: deps.baseUrl,
    fetch: deps.fetch,
  });
  const sleep = deps.sleep ?? defaultSleep;
  const maxAttempts = requestBundleBackoffMs.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await trpcClient.mutation(
      "gitwolf.flowsBundle",
      { envId },
      flowsBundleResponseSchema,
    );
    if (result.ok) return { signedUrl: result.data.url };

    const lastAttempt = attempt === maxAttempts;
    const retryable = result.error.kind === "network";
    if (lastAttempt || !retryable) {
      throw new Error(describeBundleRequestError(result.error, deps.baseUrl));
    }
    const backoff = requestBundleBackoffMs[attempt - 1];
    if (backoff === undefined) {
      throw new Error("internal: requestBundle backoff index out of bounds");
    }
    await sleep(backoff);
  }
  throw new Error("internal: requestBundle retry loop exited unexpectedly");
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise<void>((res) => setTimeout(res, ms));
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
  log: (message: string) => void;
  confirm: (message: string) => Promise<boolean>;
};

export async function checkSafety(
  args: CheckSafetyArgs,
): Promise<"proceed" | "abort"> {
  const existing = await readManifest(args.envDir);
  if (existing === "missing") return "proceed";
  if (existing === "malformed") {
    args.log(
      "Existing .manifest.json is unreadable; proceeding without local-modification check.",
    );
    return "proceed";
  }
  return promptOverwriteIfModified({
    envDir: args.envDir,
    manifest: existing,
    yes: args.yes,
    log: args.log,
    confirm: args.confirm,
  });
}
