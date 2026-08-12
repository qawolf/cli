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

/**
 * A fetch whose headers arrive but whose body never does: the response is ok and
 * reading it raises the timeout, which is what a stall part-way through a
 * download looks like to a caller.
 */
export function makeTimingOutBodyFetch(): typeof fetch {
  return mock<FetchImpl>(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(timeoutAbortError());
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  ) as unknown as typeof fetch;
}

/**
 * A fetch whose body delivers `chunks` right away and then stalls forever. Like
 * a real fetch, aborting the request signal errors the pending body read with
 * the abort reason.
 */
export function makeStallingBodyFetch(chunks: string[]): typeof fetch {
  return mock<FetchImpl>(async (_url, init) => {
    const signal = init?.signal;
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          signal?.addEventListener("abort", () =>
            controller.error(signal.reason),
          );
        },
      }),
    );
  }) as unknown as typeof fetch;
}

/**
 * A fetch whose body delivers one of `chunks` every `intervalMs` and then
 * closes — a slow download that never stops making progress. Like a real fetch,
 * aborting the request signal errors the pending body read with the abort
 * reason.
 */
export function makeDrippingBodyFetch(
  chunks: string[],
  intervalMs: number,
): typeof fetch {
  return mock<FetchImpl>(async (_url, init) => {
    const signal = init?.signal;
    return new Response(
      new ReadableStream({
        start(controller) {
          let delivered = 0;
          const timer = setInterval(() => {
            const chunk = chunks[delivered];
            delivered += 1;
            if (chunk === undefined) {
              clearInterval(timer);
              controller.close();
              return;
            }
            controller.enqueue(new TextEncoder().encode(chunk));
          }, intervalMs);
          signal?.addEventListener("abort", () => {
            clearInterval(timer);
            controller.error(signal.reason);
          });
        },
      }),
    );
  }) as unknown as typeof fetch;
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
