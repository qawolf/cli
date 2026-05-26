import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import type { WireResult } from "./createTrpcClient.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  fs?: Fs | undefined;
};

const timeoutMs = 30_000;

export async function fetchSignedUrl(
  args: { url: string; dest: string },
  deps: Deps = { fetch: globalThis.fetch },
): Promise<WireResult<void>> {
  let response: Response;
  try {
    response = await deps.fetch(args.url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
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

  try {
    await (deps.fs ?? makeDefaultFs()).writeFile(
      args.dest,
      new Uint8Array(await response.arrayBuffer()),
    );
  } catch (error: unknown) {
    return { ok: false, error: { cause: toError(error), kind: "network" } };
  }

  return { ok: true, data: undefined };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
