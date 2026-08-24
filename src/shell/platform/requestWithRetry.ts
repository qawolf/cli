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
 *
 * `exitCode` is set when the failure kind maps to a documented CLI exit code
 * (auth = 3); commands surface it so callers can branch on exit status.
 */
export type PlatformFailure = {
  error: string;
  errorBody?: string;
  exitCode?: number;
  mayHaveArrived?: boolean;
};

export type PlatformResult<T> =
  | { ok: true; value: T }
  | ({ ok: false } & PlatformFailure);

/**
 * Narrows a failed result to just its error fields, so a caller can rebuild
 * it as its own result type. Omits `errorBody` and `exitCode` entirely when
 * absent, rather than setting them to undefined.
 */
export function failureFields(failure: PlatformFailure): PlatformFailure {
  return {
    error: failure.error,
    ...(failure.errorBody ? { errorBody: failure.errorBody } : {}),
    ...(failure.exitCode === undefined ? {} : { exitCode: failure.exitCode }),
  };
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
      // Only an HTTP status proves the server answered without acting on a
      // lost request. A reached deadline says nothing about whether the server
      // acted; an unparseable reply is the server answering, so the request
      // certainly arrived; and a network failure covers a connection reset
      // after the request body was sent just as it covers one refused outright,
      // so it cannot prove the request never arrived either.
      const mayHaveArrived = result.error.kind !== "http";
      return {
        ok: false,
        ...args.describe(result.error),
        ...(mayHaveArrived ? { mayHaveArrived } : {}),
      };
    }
    await sleep(backoff);
  }
}
