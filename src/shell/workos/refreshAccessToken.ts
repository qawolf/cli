import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";
import { readConnectTokens } from "./connectTokens.js";
import { sendWorkosRequest } from "./send.js";
import type { AuthorizationResult, WorkosDeps } from "./types.js";

/**
 * Trades a refresh token for a fresh pair bound to the API resource.
 *
 * Refresh tokens rotate: the response carries a replacement and the token
 * passed in is spent. Callers must persist `refreshToken` from the result, or
 * the next refresh fails and the person is silently signed out.
 *
 * `resource` goes on every refresh. Omitting it was observed to hand back
 * a token whose audience is the environment client id, which the API refuses,
 * so a refresh without it would quietly end the session on the next request.
 */
export async function refreshAccessToken(
  refreshToken: string,
  deps: WorkosDeps,
): Promise<AuthorizationResult<DeviceTokens>> {
  const outcome = await sendWorkosRequest(
    deps.endpoints.token,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: deps.clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        resource: deps.resource,
      }).toString(),
    },
    deps.fetch,
  );

  if (outcome.kind === "failure") {
    return { ok: false, error: outcome.detail, retryable: outcome.retryable };
  }

  if (outcome.kind === "oauth-error") {
    // An unregistered resource is a deployment-configuration fault, not a
    // spent session: neither retrying nor signing in again changes it, and
    // falling back to a token without the resource would only produce one the
    // API refuses. Named as such so nobody is sent round that loop.
    if (outcome.code === "invalid_target") {
      return {
        ok: false,
        error: authErrorMessages.workos.resourceNotRegistered(deps.resource),
        retryable: false,
      };
    }
    // A protocol answer WorkOS meant. Repeating it changes nothing.
    return {
      ok: false,
      error: outcome.description ?? outcome.code,
      retryable: false,
    };
  }

  const tokens = readConnectTokens(outcome.json);
  if (!tokens.ok) return { ok: false, error: tokens.error, retryable: false };

  return { ok: true, value: tokens.tokens };
}
