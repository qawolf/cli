import superjson, { type SuperJSONResult } from "superjson";
import type { z } from "zod";

import { isTimeoutError } from "~/core/errors.js";

import type { WireResult } from "./createTrpcClient.js";
import { toError } from "./toError.js";

/**
 * Makes one request under a deadline and returns its body parsed by `schema`,
 * as a WireResult — this never throws, so a caller reads the failure rather than
 * catching it. The deadline is applied here so that reaching it is reported as
 * the wait it was, distinct from a host that could not be reached.
 */
export async function sendWireRequest<T>(
  fetchFn: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<WireResult<T>> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
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

  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    return { ok: false, error: { cause: toError(error), kind: "parse" } };
  }

  try {
    const data = unwrap(body);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: { cause: parsed.error, kind: "parse" } };
    }
    return { ok: true, data: parsed.data };
  } catch (error: unknown) {
    return { ok: false, error: { cause: toError(error), kind: "parse" } };
  }
}

function unwrap(body: unknown): unknown {
  if (!isRecord(body) || !isRecord(body["result"])) return body;
  const data = body["result"]["data"];
  if (isSuperJSONResult(data)) return superjson.deserialize(data);
  return data;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isSuperJSONResult = (v: unknown): v is SuperJSONResult =>
  isRecord(v) && "json" in v;
