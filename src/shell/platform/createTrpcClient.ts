import superjson, { type SuperJSONResult } from "superjson";
import type { z } from "zod";
import type { Logger } from "~/shell/logger.js";

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
  logger?: Logger;
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

export function createTrpcClient(apiKey: string, deps: Deps): TrpcClient {
  const authHeader = { Authorization: `Bearer ${apiKey}` };
  const { logger } = deps;

  async function withLogging<T>(
    path: string,
    call: () => Promise<WireResult<T>>,
  ): Promise<WireResult<T>> {
    logger?.debug(`→ ${path}`);
    const result = await call();
    if (result.ok) {
      logger?.debug(`← ${path} ok`);
    } else {
      const e = result.error;
      const raw = e.kind === "http" ? e.body : e.cause.message;
      const clipped = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
      const msg = e.kind === "http" ? `${e.status} ${clipped}` : clipped;
      logger?.warn(`← ${path} error (${e.kind}): ${msg}`);
    }
    return result;
  }

  return {
    query: (path, input, schema) => {
      const encoded = encodeURIComponent(
        JSON.stringify(superjson.serialize(input)),
      );
      const url = `${deps.baseUrl}/api/trpc/${path}?input=${encoded}`;
      return withLogging(path, () =>
        send(
          deps.fetch,
          url,
          {
            headers: authHeader,
            method: "GET",
            signal: AbortSignal.timeout(timeoutMs),
          },
          schema,
        ),
      );
    },
    mutation: (path, input, schema) => {
      const url = `${deps.baseUrl}/api/trpc/${path}`;
      const body = JSON.stringify(superjson.serialize(input));
      return withLogging(path, () =>
        send(
          deps.fetch,
          url,
          {
            body,
            headers: { ...authHeader, "content-type": "application/json" },
            method: "POST",
            signal: AbortSignal.timeout(timeoutMs),
          },
          schema,
        ),
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const isSuperJSONResult = (v: unknown): v is SuperJSONResult =>
  isRecord(v) && "json" in v;
const toError = (v: unknown): Error =>
  v instanceof Error ? v : new Error(String(v));
