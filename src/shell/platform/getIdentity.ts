import { z } from "zod";

import { errorMessage } from "~/core/errors.js";

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

type GetIdentityDeps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

export async function getIdentity(
  apiKey: string,
  deps: GetIdentityDeps,
): Promise<GetIdentityResult> {
  const url = `${deps.baseUrl}/api/v0/identity`;

  let response: Response;
  try {
    response = await deps.fetch(url, {
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
      error: parseErrorBody(body) || response.statusText,
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

// Extract `error` from a JSON body like `{"error":"..."}` so we don't
// surface raw HTML/JSON to users. Empty string means "fall back to statusText".
function parseErrorBody(body: string): string {
  if (!body) return "";
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // not JSON; fall through
  }
  return "";
}
