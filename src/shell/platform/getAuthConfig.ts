import { z } from "zod";

import { errorMessage } from "~/core/errors.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

const authConfigBody = z.object({
  workOsClientId: z.string().min(1),
});

export type AuthConfigResult =
  | { kind: "configured"; clientId: string }
  /** The deployment answered, and offers no browser sign-in. */
  | { kind: "unconfigured" }
  /**
   * The deployment could not be asked. This says nothing about whether it
   * offers browser sign-in, so it must not be reported as though it did.
   */
  | { kind: "unreachable"; detail: string };

/**
 * Read without credentials, because a client needs the id to obtain a token and
 * a token to call anything authenticated.
 *
 * A deployment that predates this route answers 404, which is a real answer:
 * it publishes no client id. A timeout or a dropped connection is not, and
 * collapsing the two would tell someone on a flaky link a permanent falsehood
 * about their deployment.
 */
export async function getAuthConfig(deps: Deps): Promise<AuthConfigResult> {
  let response: Response;
  try {
    response = await deps.fetch(`${deps.baseUrl}/api/v0/auth/config`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    return { kind: "unreachable", detail: errorMessage(err) };
  }

  // A 404 is the pre-route deployments answering honestly. A 5xx, a 429 or a 408
  // is the server failing to answer at all, which says nothing about whether it
  // offers browser sign-in — reporting those as "offers none" states a permanent
  // falsehood about the deployment.
  if (
    response.status >= 500 ||
    response.status === 429 ||
    response.status === 408
  ) {
    return { kind: "unreachable", detail: `HTTP ${response.status}` };
  }
  if (!response.ok) return { kind: "unconfigured" };

  let json: unknown;
  try {
    json = await response.json();
  } catch (err: unknown) {
    return { kind: "unreachable", detail: errorMessage(err) };
  }

  const parsed = authConfigBody.safeParse(json);
  return parsed.success
    ? { kind: "configured", clientId: parsed.data.workOsClientId }
    : { kind: "unconfigured" };
}
