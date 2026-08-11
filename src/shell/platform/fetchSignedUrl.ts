import { isTimeoutError } from "~/core/errors.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import type { WireResult } from "./createTrpcClient.js";
import { toError } from "./toError.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  fs?: Fs | undefined;
  stallTimeoutMs?: number | undefined;
};

const defaultStallTimeoutMs = 30_000;

// bun-types has no global ReadableStreamReadResult and types body reads as
// `any`; this mirrors the default reader's result shape.
type BodyReadResult =
  | { done: false; value: Uint8Array }
  | { done: true; value: undefined };

export async function fetchSignedUrl(
  args: { url: string; dest: string },
  deps: Deps = { fetch: globalThis.fetch },
): Promise<WireResult<void>> {
  const timeoutMs = deps.stallTimeoutMs ?? defaultStallTimeoutMs;

  // The window is a stall timeout, not a whole-download deadline: it resets
  // every time bytes arrive, so a slow-but-progressing download of any size can
  // finish while a genuine stall still fails. Aborting the request signal makes
  // fetch reject a pending body read with the abort reason.
  const controller = new AbortController();
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const armStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(
      () =>
        controller.abort(
          new DOMException("The operation timed out.", "TimeoutError"),
        ),
      timeoutMs,
    );
  };

  try {
    armStallTimer();
    let response: Response;
    try {
      response = await deps.fetch(args.url, { signal: controller.signal });
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

    if (!response.body) {
      return {
        ok: false,
        error: { cause: new Error("response had no body"), kind: "network" },
      };
    }

    // Read the body before writing it, so a stall part-way through the
    // download is a timeout while a failed write is local.
    const chunks: Uint8Array[] = [];
    try {
      const reader = response.body.getReader();
      for (;;) {
        const result: BodyReadResult = await reader.read();
        if (result.done) break;
        chunks.push(result.value);
        armStallTimer();
      }
    } catch (error: unknown) {
      if (isTimeoutError(error)) {
        return { ok: false, error: { kind: "timeout", timeoutMs } };
      }
      return { ok: false, error: { cause: toError(error), kind: "network" } };
    }

    try {
      const downloaded = new Uint8Array(
        chunks.reduce((total, chunk) => total + chunk.byteLength, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        downloaded.set(chunk, offset);
        offset += chunk.byteLength;
      }
      await (deps.fs ?? makeDefaultFs()).writeFile(args.dest, downloaded);
    } catch (error: unknown) {
      return { ok: false, error: { cause: toError(error), kind: "network" } };
    }

    return { ok: true, data: undefined };
  } finally {
    clearTimeout(stallTimer);
  }
}
