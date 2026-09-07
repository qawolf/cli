import { readTokenClaims } from "~/core/deviceAuth/tokenClaims.js";
import { readAccessTokenExpiry } from "~/core/deviceAuth/tokenExpiry.js";
import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";
import { unexpectedResponse } from "./send.js";
import { connectTokenBody } from "./types.js";

/**
 * A successful token-endpoint body, shared by the device grant and the refresh
 * grant since Connect answers both the same way.
 */
export function readConnectTokens(
  json: unknown,
): { ok: true; tokens: DeviceTokens } | { ok: false; error: string } {
  const parsed = connectTokenBody.safeParse(json);
  if (!parsed.success) return { ok: false, error: unexpectedResponse };

  // Without one there is no way to reach the resource-bound token the API
  // accepts, so the response is unusable however the rest of it looks.
  if (!parsed.data.refresh_token) {
    return { ok: false, error: authErrorMessages.workos.noRefreshToken };
  }

  const orgId = readTokenClaims(parsed.data.access_token)?.["org_id"];
  return {
    ok: true,
    tokens: {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: readAccessTokenExpiry(parsed.data.access_token),
      organizationId: typeof orgId === "string" && orgId ? orgId : undefined,
    },
  };
}
