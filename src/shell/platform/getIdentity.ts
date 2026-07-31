import { z } from "zod";
import { isTimeoutError } from "~/core/errors.js";
import type { WireResult } from "./createTrpcClient.js";
import { toError } from "./toError.js";

const identityResponseSchema = z.object({
  team: z.object({
    createdAt: z.string(),
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
  }),
});

export type IdentityResponse = z.infer<typeof identityResponseSchema>;

type GetIdentityDeps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

export async function getIdentity(
  apiKey: string,
  deps: GetIdentityDeps,
): Promise<WireResult<IdentityResponse>> {
  const url = `${deps.baseUrl}/api/v0/identity`;

  let response: Response;
  try {
    response = await deps.fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return { ok: false, error: { kind: "timeout", timeoutMs } };
    }
    return {
      ok: false,
      error: { kind: "network", cause: toError(error) },
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: { kind: "http", status: response.status, body },
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error: unknown) {
    if (isTimeoutError(error)) {
      return { ok: false, error: { kind: "timeout", timeoutMs } };
    }
    json = undefined;
  }

  const parsed = identityResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { kind: "parse", cause: parsed.error } };
  }

  return { ok: true, data: parsed.data };
}
