import { z } from "zod";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

const authConfigBody = z.object({
  workOsClientId: z.string().min(1),
});

/**
 * Read without credentials, because a client needs the id to obtain a token and
 * a token to call anything authenticated. Undefined on any failure: a
 * deployment that predates this route, or publishes none, is one where browser
 * sign-in is unavailable.
 */
export async function getAuthConfig(deps: Deps): Promise<string | undefined> {
  let response: Response;
  try {
    response = await deps.fetch(`${deps.baseUrl}/api/v0/auth/config`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return undefined;
  }

  if (!response.ok) return undefined;

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return undefined;
  }

  const parsed = authConfigBody.safeParse(json);
  return parsed.success ? parsed.data.workOsClientId : undefined;
}
