import { isTimeoutError } from "~/core/errors.js";
import { makeDefaultFs, type Fs, type FsWriteHandle } from "~/shell/fs.js";
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
  const fs = deps.fs ?? makeDefaultFs();
  // Chunks stream to a sibling .part file so peak memory stays at one chunk
  // regardless of asset size; the finished file is renamed into place.
  const partPath = `${args.dest}.part`;

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

    let handle: FsWriteHandle;
    try {
      handle = await fs.openWriteHandle(partPath);
    } catch (error: unknown) {
      return { ok: false, error: { cause: toError(error), kind: "network" } };
    }
    const discardPart = async () => {
      await handle.close().catch(() => {});
      await fs.unlink(partPath).catch(() => {});
    };

    // Reads and writes report through separate catches so a failed disk write
    // stays a local error and never masquerades as a network stall.
    const reader = response.body.getReader();
    for (;;) {
      let result: BodyReadResult;
      try {
        result = await reader.read();
      } catch (error: unknown) {
        await discardPart();
        if (isTimeoutError(error)) {
          return { ok: false, error: { kind: "timeout", timeoutMs } };
        }
        return { ok: false, error: { cause: toError(error), kind: "network" } };
      }
      if (result.done) break;
      // The stall clock measures the network, not the disk: pause it while a
      // chunk is being written so a slow disk cannot abort a live download.
      clearTimeout(stallTimer);
      try {
        await handle.write(result.value);
      } catch (error: unknown) {
        await discardPart();
        return { ok: false, error: { cause: toError(error), kind: "network" } };
      }
      armStallTimer();
    }

    try {
      await handle.close();
      await fs.rename(partPath, args.dest);
    } catch (error: unknown) {
      await fs.unlink(partPath).catch(() => {});
      return { ok: false, error: { cause: toError(error), kind: "network" } };
    }
    return { ok: true, data: undefined };
  } finally {
    clearTimeout(stallTimer);
  }
}
