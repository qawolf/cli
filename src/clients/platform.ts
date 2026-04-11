import { z } from "zod";

import { getApiBaseUrl } from "~/lib/config.js";

export { type ValidateApiKeyResult, validateApiKey } from "~/lib/auth/index.js";

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

export async function getIdentity(apiKey: string): Promise<GetIdentityResult> {
  const url = `${getApiBaseUrl()}/api/v0/identity`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    return { ok: false, status: 0, error: message };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: body || response.statusText,
    };
  }

  const json: unknown = await response.json();
  const parsed = identityResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      status: response.status,
      error: "Unexpected response format",
    };
  }

  return { ok: true, data: parsed.data };
}
