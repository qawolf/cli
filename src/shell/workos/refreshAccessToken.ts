import { readAccessTokenExpiry } from "~/core/deviceAuth/tokenExpiry.js";
import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { sendWorkosRequest, unexpectedResponse } from "./send.js";
import {
  type AuthorizationResult,
  deviceTokenBody,
  type WorkosDeps,
} from "./types.js";

/**
 * Trades a refresh token for a fresh access token.
 *
 * Refresh tokens rotate: the response carries a replacement and the token
 * passed in is spent. Callers must persist `refreshToken` from the result, or
 * the next refresh fails and the person is silently signed out.
 *
 * `organizationId` pins the session to one WorkOS organization. WorkOS supports
 * this for public clients, and it is what lets the CLI stay in — or move to — a
 * chosen organization instead of accepting whichever one it is given.
 */
export async function refreshAccessToken(
  refreshToken: string,
  organizationId: string | undefined,
  deps: WorkosDeps,
): Promise<AuthorizationResult<DeviceTokens>> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: deps.clientId,
  });
  if (organizationId) params.set("organization_id", organizationId);

  const outcome = await sendWorkosRequest(
    `${deps.baseUrl}/user_management/authenticate`,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
    deps.fetch,
  );

  if (outcome.kind === "failure") {
    return { ok: false, error: outcome.detail, retryable: outcome.retryable };
  }

  if (outcome.kind === "oauth-error") {
    // A protocol answer WorkOS meant. Repeating it changes nothing.
    return {
      ok: false,
      error: outcome.description ?? outcome.code,
      retryable: false,
    };
  }

  const parsed = deviceTokenBody.safeParse(outcome.json);
  if (!parsed.success) {
    return { ok: false, error: unexpectedResponse, retryable: false };
  }

  return {
    ok: true,
    value: {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: readAccessTokenExpiry(parsed.data.access_token),
      email: parsed.data.user.email,
      organizationId: parsed.data.organization_id,
    },
  };
}
