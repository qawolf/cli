import {
  createTRPCClient,
  httpLink,
  isNonJsonSerializable,
  isTRPCClientError,
} from "@trpc/client";
import superjson, { type SuperJSONResult } from "superjson";
import { z } from "zod";

import { getApiBaseUrl } from "~/lib/config.js";
import { errorMessage } from "~/lib/errors.js";

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
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

function createPlatformClient(apiKey: string) {
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

type GetIdentityError = Extract<GetIdentityResult, { ok: false }>;

function mapTrpcError(error: unknown): GetIdentityError {
  if (isTRPCClientError(error)) {
    const httpStatus = (error.data as { httpStatus?: number } | undefined)
      ?.httpStatus;
    if (httpStatus !== undefined) {
      return { ok: false, status: httpStatus, error: error.message };
    }
    return { ok: false, error: error.message };
  }
  return { ok: false, error: errorMessage(error) };
}
