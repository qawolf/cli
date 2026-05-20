import type { WireError, WireResult } from "./createTrpcClient.js";

type RequestWithRetryArgs<T> = {
  // The wire call to make. Should return a WireResult<T>; do not throw.
  call: () => Promise<WireResult<T>>;
  // Backoff schedule. Length = retry budget. Final attempt has no backoff
  // and surfaces the error if it still hasn't succeeded.
  backoffMs: readonly number[];
  // Builds the user-facing error message from the WireError.
  describe: (err: WireError) => string;
  // Override for setTimeout-based sleep (tests pass a no-op). Pass undefined
  // for production callers; the helper supplies a real setTimeout sleep.
  sleep: ((ms: number) => Promise<void>) | undefined;
};

export const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Retries `call` on transient network errors only; HTTP/parse errors are
// deterministic and surface immediately. The infinite loop is bounded by the
// `backoffMs` array: once `backoffMs[attempt]` is undefined, the next non-ok
// result throws.
export async function requestWithRetry<T>(
  args: RequestWithRetryArgs<T>,
): Promise<T> {
  const sleep = args.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    const result = await args.call();
    if (result.ok) return result.data;

    const backoff = args.backoffMs[attempt];
    const retryable = result.error.kind === "network";
    if (backoff === undefined || !retryable) {
      throw new Error(args.describe(result.error));
    }
    await sleep(backoff);
  }
}
