import { openAsBlob } from "node:fs";

import { isTimeoutError } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";

import type { WireResult } from "./createTrpcClient.js";
import { toError } from "./toError.js";

// A whole-upload deadline rather than a stall timer: fetch reports no upload
// progress to reset one on. Thirty minutes lets 500 MB through at ~300 KB/s.
const defaultUploadTimeoutMs = 30 * 60 * 1000;

type Deps = {
  fetch: typeof globalThis.fetch;
  timeoutMs?: number | undefined;
};

/**
 * Opens a regular file as a disk-backed Blob, so a large upload streams from
 * disk instead of being read into memory. Answers undefined when the path is
 * missing, unreadable, or not a regular file.
 */
export async function openFileAsBlob(
  fs: Pick<Fs, "stat">,
  path: string,
): Promise<Blob | undefined> {
  try {
    const stats = await fs.stat(path);
    return stats.isFile() ? await openAsBlob(path) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * PUTs a body to a signed URL with the headers it was signed for. Never
 * retries: a create-only URL refuses a second write, so a retry after a PUT
 * that landed would report a failure for an upload that succeeded.
 */
export async function putSignedUrl(
  args: { body: Blob; headers: Record<string, string>; url: string },
  deps: Deps = { fetch: globalThis.fetch },
): Promise<WireResult<void>> {
  const timeoutMs = deps.timeoutMs ?? defaultUploadTimeoutMs;
  let response: Response;
  try {
    response = await deps.fetch(args.url, {
      body: args.body,
      headers: args.headers,
      method: "PUT",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return { ok: false, error: { kind: "timeout", timeoutMs } };
    }
    return { ok: false, error: { cause: toError(error), kind: "network" } };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: { body, kind: "http", status: response.status },
    };
  }
  return { ok: true, data: undefined };
}
