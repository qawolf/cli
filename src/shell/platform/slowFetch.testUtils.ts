import { mock } from "bun:test";

// The shape a fetch mock implements. `typeof fetch` carries statics (preconnect)
// that a plain function cannot, so implementations are typed against this and
// cast once here.
type FetchImpl = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** What `AbortSignal.timeout` raises once its deadline passes. */
export function timeoutAbortError(): DOMException {
  return new DOMException("The operation timed out.", "TimeoutError");
}

/**
 * A fetch that never answers on its own and settles only when its signal aborts,
 * so the deadline under test is the only thing that can end the call.
 */
export function makeHangingFetch(): typeof fetch {
  return mock<FetchImpl>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(timeoutAbortError()),
        );
      }),
  ) as unknown as typeof fetch;
}

/** A fetch that answers after `delayMs`, unless its deadline arrives first. */
export function makeDelayedFetch(
  makeResponse: () => Response,
  delayMs: number,
): typeof fetch {
  return mock<FetchImpl>(
    (_url, init) =>
      new Promise<Response>((resolve, reject) => {
        setTimeout(() => resolve(makeResponse()), delayMs);
        init?.signal?.addEventListener("abort", () =>
          reject(timeoutAbortError()),
        );
      }),
  ) as unknown as typeof fetch;
}
