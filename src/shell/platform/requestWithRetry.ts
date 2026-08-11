import { sleep as defaultSleep } from "~/core/sleep.js";
import type { WireError, WireResult } from "./createTrpcClient.js";

/**
 * A failure split into a short, stable title callers can branch on and an
 * optional longer reason from the server.
 */
export type PlatformError = { error: string; errorBody?: string };

export type PlatformResult<T> =
  | { ok: true; value: T }
  | ({ ok: false } & PlatformError);

/**
 * Narrows a failed result to just its error fields, so a caller can rebuild
 * it as its own result type. Omits `errorBody` entirely when the server gave
 * no reason, rather than setting it to undefined.
 */
export function failureFields(failure: PlatformError): PlatformError {
  return failure.errorBody
    ? { error: failure.error, errorBody: failure.errorBody }
    : { error: failure.error };
}

type RequestWithRetryArgs<T> = {
  // The wire call to make. Should return a WireResult<T>; do not throw.
  call: () => Promise<WireResult<T>>;
  // Backoff schedule. Length = retry budget. Final attempt has no backoff
  // and surfaces the error if it still hasn't succeeded.
  backoffMs: readonly number[];
  // Builds the user-facing error from the WireError.
  describe: (err: WireError) => PlatformError;
  // Override for sleep (tests pass a no-op). Pass undefined for production
  // callers; the helper supplies the real implementation.
  sleep: ((ms: number) => Promise<void>) | undefined;
};

// Retries `call` on transient network errors and reached deadlines only;
// HTTP/parse errors are deterministic and surface immediately. The infinite loop
// is bounded by the `backoffMs` array: once `backoffMs[attempt]` is undefined,
// the next non-ok result surfaces the error.
export async function requestWithRetry<T>(
  args: RequestWithRetryArgs<T>,
): Promise<PlatformResult<T>> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    const result = await args.call();
    if (result.ok) return { ok: true, value: result.data };

    const backoff = args.backoffMs[attempt];
    const retryable =
      result.error.kind === "network" || result.error.kind === "timeout";
    if (backoff === undefined || !retryable) {
      return { ok: false, ...args.describe(result.error) };
    }
    await sleep(backoff);
  }
}
