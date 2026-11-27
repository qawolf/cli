import { isTimeoutError } from "~/core/errors.js";

import type { ArtifactFailure } from "./types.js";

// Covers the whole transfer: 75 MiB in two minutes requires ~5.24 Mbit/s.
export const downloadTimeoutMs = 120_000;

function downloadFailure(error: unknown): ArtifactFailure {
  return { status: isTimeoutError(error) ? "timed-out" : "unavailable" };
}

/** Aborts the request once `read` settles: cancelling a body alone leaves Bun downloading the rest. The deadline defaults to `downloadTimeoutMs` from now. */
export async function fetchAndRead<Read>(
  request: {
    deadline?: AbortSignal;
    fetchImpl: typeof globalThis.fetch;
    headers?: Record<string, string>;
    url: string;
  },
  read: (response: Response) => Promise<Read>,
): Promise<Read | ArtifactFailure> {
  const done = new AbortController();
  try {
    const response = await request.fetchImpl(request.url, {
      ...(request.headers && { headers: request.headers }),
      redirect: "follow",
      signal: AbortSignal.any([
        done.signal,
        request.deadline ?? AbortSignal.timeout(downloadTimeoutMs),
      ]),
    });
    return await read(response);
  } catch (error) {
    return downloadFailure(error);
  } finally {
    done.abort();
  }
}
