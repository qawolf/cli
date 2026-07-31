import superjson from "superjson";
import type { z } from "zod";
import type { Logger } from "~/shell/logger.js";

import { sendWireRequest } from "./sendWireRequest.js";

export type WireError =
  | { kind: "http"; status: number; body: string }
  | { kind: "network"; cause: Error }
  | { kind: "timeout"; timeoutMs: number }
  | { kind: "parse"; cause: Error };

export type WireResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WireError };

/** Per-call overrides, for the calls that differ from the client's defaults. */
export type RequestOptions = {
  timeoutMs?: number;
};

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
  logger?: Logger;
  defaultTimeoutMs?: number;
};

export type TrpcClient = {
  query: <T>(
    path: string,
    input: unknown,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ) => Promise<WireResult<T>>;
  mutation: <T>(
    path: string,
    input: unknown,
    schema: z.ZodType<T>,
    options?: RequestOptions,
  ) => Promise<WireResult<T>>;
};

/** Fits a call the platform answers from its database, which is most of them. */
const defaultRequestTimeoutMs = 15_000;

export function createTrpcClient(apiKey: string, deps: Deps): TrpcClient {
  const authHeader = { Authorization: `Bearer ${apiKey}` };
  const { logger } = deps;
  const defaultTimeoutMs = deps.defaultTimeoutMs ?? defaultRequestTimeoutMs;

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
      logger?.warn(`← ${path} error (${e.kind}): ${summarize(e)}`);
    }
    return result;
  }

  return {
    query: (path, input, schema, options) => {
      const encoded = encodeURIComponent(
        JSON.stringify(superjson.serialize(input)),
      );
      const url = `${deps.baseUrl}/api/trpc/${path}?input=${encoded}`;
      return withLogging(path, () =>
        sendWireRequest(
          deps.fetch,
          url,
          { headers: authHeader, method: "GET" },
          schema,
          options?.timeoutMs ?? defaultTimeoutMs,
        ),
      );
    },
    mutation: (path, input, schema, options) => {
      const url = `${deps.baseUrl}/api/trpc/${path}`;
      const body = JSON.stringify(superjson.serialize(input));
      return withLogging(path, () =>
        sendWireRequest(
          deps.fetch,
          url,
          {
            body,
            headers: { ...authHeader, "content-type": "application/json" },
            method: "POST",
          },
          schema,
          options?.timeoutMs ?? defaultTimeoutMs,
        ),
      );
    },
  };
}

function clip(text: string): string {
  return text.length > 200 ? text.slice(0, 200) + "…" : text;
}

function summarize(error: WireError): string {
  if (error.kind === "http") return `${error.status} ${clip(error.body)}`;
  if (error.kind === "timeout") return `timed out after ${error.timeoutMs}ms`;
  return clip(error.cause.message);
}
