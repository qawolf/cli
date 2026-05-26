import { z } from "zod";
import type { WireResult } from "./createTrpcClient.js";

// `executionTarget` is either a preset string ("Web - Chrome") or an ad-hoc
// target object; accept both and let the display layer flatten it.
const remoteFlowSchema = z.object({
  executionTarget: z.union([z.string(), z.record(z.string(), z.unknown())]),
  id: z.string(),
  name: z.string(),
  path: z.string(),
  tags: z.array(z.string()),
});

const remoteFlowsResponseSchema = z.object({
  flows: z.array(remoteFlowSchema),
});

export type RemoteFlowsResponse = z.infer<typeof remoteFlowsResponseSchema>;

type GetRemoteFlowsDeps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

export async function getRemoteFlows(
  apiKey: string,
  deps: GetRemoteFlowsDeps,
): Promise<WireResult<RemoteFlowsResponse>> {
  const url = `${deps.baseUrl}/api/v0/flows?includeDrafts=false`;

  let response: Response;
  try {
    response = await deps.fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error: unknown) {
    return { ok: false, error: { kind: "network", cause: toError(error) } };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: { kind: "http", status: response.status, body },
    };
  }

  const json: unknown = await response.json().catch(() => undefined);
  const parsed = remoteFlowsResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: { kind: "parse", cause: parsed.error } };
  }

  return { ok: true, data: parsed.data };
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
