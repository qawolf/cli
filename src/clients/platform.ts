import { z } from "zod";

import { getApiBaseUrl } from "~/lib/config.js";
import { errorMessage } from "~/lib/errors.js";

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

export async function getIdentity(apiKey: string): Promise<GetIdentityResult> {
  const url = `${getApiBaseUrl()}/api/v0/identity`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      error: body || response.statusText,
    };
  }

  const json: unknown = await response.json().catch(() => undefined);
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
