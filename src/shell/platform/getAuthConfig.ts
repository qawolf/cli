import { z } from "zod";

import { errorMessage } from "~/core/errors.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

const timeoutMs = 10_000;

const authConfigBody = z.object({
  /** The WorkOS environment client id, which the legacy flow signed in with. */
  workOsClientId: z.string().min(1),
  /** The WorkOS Connect issuer, when the deployment accepts Connect tokens. */
  authorizationServer: z.string().optional(),
  /** The public Connect application to sign in with, paired with the issuer. */
  workOsConnectClientId: z.string().optional(),
});

export type AuthConfigResult =
  /** Connect sign-in is on offer: discover the issuer, sign in as this client. */
  | { kind: "configured"; issuer: string; clientId: string }
  /**
   * The deployment publishes only the environment client id. Tokens from that
   * flow carry it as their audience, which the API refuses, so this is
   * reported as its own thing rather than as a client to sign in with.
   */
  | { kind: "legacy-only" }
  /** One half of the Connect configuration without the other. */
  | { kind: "misconfigured"; detail: string }
  /** The deployment answered, and offers no browser sign-in. */
  | { kind: "unconfigured" }
  /**
   * The deployment could not be asked. This says nothing about whether it
   * offers browser sign-in, so it must not be reported as though it did.
   */
  | { kind: "unreachable"; detail: string };

function classify(body: z.infer<typeof authConfigBody>): AuthConfigResult {
  const issuer = body.authorizationServer?.trim();
  const clientId = body.workOsConnectClientId?.trim();

  if (issuer && clientId) return { kind: "configured", issuer, clientId };
  if (!issuer && !clientId) return { kind: "legacy-only" };

  // Substituting the environment id here would sign someone in to a token the
  // API then refuses, with nothing to say why.
  return {
    kind: "misconfigured",
    detail: authErrorMessages.authConfig.halfConfigured(
      issuer ? "workOsConnectClientId" : "authorizationServer",
    ),
  };
}

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
  return parsed.success ? classify(parsed.data) : { kind: "unconfigured" };
}
