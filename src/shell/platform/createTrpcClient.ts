import superjson, { type SuperJSONResult } from "superjson";
import type { z } from "zod";

import { getApiBaseUrl } from "~/lib/config.js";

export type WireError =
  | { kind: "http"; status: number; body: string }
  | { kind: "network"; cause: Error }
  | { kind: "parse"; cause: Error };

export type WireResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WireError };

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

export type TrpcClient = {
  query: <T>(
    path: string,
    input: unknown,
    schema: z.ZodType<T>,
  ) => Promise<WireResult<T>>;
  mutation: <T>(
    path: string,
    input: unknown,
    schema: z.ZodType<T>,
  ) => Promise<WireResult<T>>;
};

const timeoutMs = 15_000;

export function createTrpcClient(
  apiKey: string,
  deps: Deps = {
    baseUrl: getApiBaseUrl(process.env),
    fetch: globalThis.fetch,
  },
): TrpcClient {
  const authHeader = { Authorization: `Bearer ${apiKey}` };

  return {
    query: (path, input, schema) => {
      const encoded = encodeURIComponent(
        JSON.stringify(superjson.serialize(input)),
      );
      const url = `${deps.baseUrl}/api/trpc/${path}?input=${encoded}`;
      return send(
        deps.fetch,
        url,
        {
          headers: authHeader,
          method: "GET",
          signal: AbortSignal.timeout(timeoutMs),
        },
        schema,
      );
    },
    mutation: (path, input, schema) => {
      const url = `${deps.baseUrl}/api/trpc/${path}`;
      const body = JSON.stringify(superjson.serialize(input));
      return send(
        deps.fetch,
        url,
        {
          body,
          headers: { ...authHeader, "content-type": "application/json" },
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
        },
        schema,
      );
    },
  };
}

async function send<T>(
  fetchFn: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<WireResult<T>> {
  let response: Response;
  try {
    response = await fetchFn(url, init);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuperJSONResult(value: unknown): value is SuperJSONResult {
  return isRecord(value) && "json" in value;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
