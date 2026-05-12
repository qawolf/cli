import type { WireResult } from "./createTrpcClient.js";

type Deps = {
  fetch: typeof globalThis.fetch;
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

  try {
    await Bun.write(args.dest, response);
  } catch (error: unknown) {
    return { ok: false, error: { cause: toError(error), kind: "network" } };
  }

  return { ok: true, data: undefined };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
