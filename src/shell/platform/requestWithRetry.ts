import { sleep as defaultSleep } from "~/core/sleep.js";
import type { WireError, WireResult } from "./createTrpcClient.js";

/**
 * A failure split into a short, stable title callers can branch on and an
 * optional longer reason from the server.
 *
 * `mayHaveArrived` separates a request that failed on the way out from one the
 * server answered by refusing it. Only the first leaves a caller unable to say
 * whether the action happened, which for a write is the difference between
 * "retry the same id" and "that will fail the same way again".
 */
export type PlatformFailure = {
  error: string;
  errorBody?: string;
  mayHaveArrived?: boolean;
};

export type PlatformResult<T> =
  | { ok: true; value: T }
  | ({ ok: false } & PlatformFailure);

/**
 * Narrows a failed result to just its error fields, so a caller can rebuild
 * it as its own result type. Omits `errorBody` entirely when the server gave
 * no reason, rather than setting it to undefined.
 */
export function failureFields(failure: PlatformFailure): PlatformFailure {
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
  describe: (err: WireError) => PlatformFailure;
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
      // A reached deadline is the one failure that says nothing about whether
      // the server acted: the request was sent and no answer came back. An HTTP
      // status is the server answering, and a refused connection never arrived.
      const mayHaveArrived = result.error.kind === "timeout";
      return {
        ok: false,
        ...args.describe(result.error),
        ...(mayHaveArrived ? { mayHaveArrived } : {}),
      };
    }
    await sleep(backoff);
  }
}
