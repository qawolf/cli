import {
  createTRPCClient,
  httpLink,
  isNonJsonSerializable,
  isTRPCClientError,
} from "@trpc/client";
import superjson, { type SuperJSONResult } from "superjson";
import { z } from "zod";

import { getApiBaseUrl } from "~/lib/config.js";

export { type ValidateApiKeyResult, validateApiKey } from "~/lib/auth/index.js";

// Transformer matching the platform's createTrpcTransformer().
// Both sides must agree on serialization for tRPC to work.
const transformer = {
  deserialize(data: unknown): unknown {
    if (!isNonJsonSerializable(data) && isSuperJsonResult(data))
      return superjson.deserialize(data);
    return data;
  },
  serialize(data: unknown): unknown {
    if (!isNonJsonSerializable(data)) return superjson.serialize(data);
    return data;
  },
};

function isSuperJsonResult(value: unknown): value is SuperJSONResult {
  return typeof value === "object" && value !== null && "json" in value;
}

// Zod schemas for CLI-side response validation.
// These are the CLI's source of truth until cross-repo type sharing is set up.

const identityResponseSchema = z.object({
  team: z.object({
    createdAt: z.string(),
    id: z.string(),
    name: z.string(),
  }),
});

export type IdentityResponse = z.infer<typeof identityResponseSchema>;

export type GetIdentityResult =
  | { ok: true; data: IdentityResponse }
  | { ok: false; status: number; error: string };

function createPlatformClient(
  apiKey: string,
): ReturnType<typeof createTRPCClient<any>> {
  return createTRPCClient({
    links: [
      httpLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        headers: () => ({ Authorization: `Bearer ${apiKey}` }),
        transformer,
      }),
    ],
  });
}

export async function getIdentity(apiKey: string): Promise<GetIdentityResult> {
  const client = createPlatformClient(apiKey);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- bracket access needed because the untyped proxy uses an index signature
    const raw: unknown = await (client as any).identity.get.query();
    const parsed = identityResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, status: 200, error: "Unexpected response format" };
    }
    return { ok: true, data: parsed.data };
  } catch (error: unknown) {
    return mapTrpcError(error);
  }
}

function mapTrpcError(error: unknown): {
  ok: false;
  status: number;
  error: string;
} {
  if (isTRPCClientError(error)) {
    const status =
      (error.data as { httpStatus?: number } | undefined)?.httpStatus ?? 0;
    return { ok: false, status, error: error.message };
  }
  const message =
    error instanceof Error ? error.message : "Unknown network error";
  return { ok: false, status: 0, error: message };
}
