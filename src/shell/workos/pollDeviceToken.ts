import { readAccessTokenExpiry } from "~/core/deviceAuth/tokenExpiry.js";
import type { PollResponse } from "~/core/deviceAuth/types.js";
import { sendWorkosRequest, unexpectedResponse } from "./send.js";
import { deviceTokenBody, type WorkosDeps } from "./types.js";

const deviceCodeGrantType = "urn:ietf:params:oauth:grant-type:device_code";

/**
 * One attempt at redeeming a device code, translated from OAuth wire codes into
 * the vocabulary the pure state machine understands. Looping and backing off
 * are the caller's job.
 */
export async function pollDeviceToken(
  deviceCode: string,
  deps: WorkosDeps,
): Promise<PollResponse> {
  const outcome = await sendWorkosRequest(
    `${deps.baseUrl}/user_management/authenticate`,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: deviceCodeGrantType,
        device_code: deviceCode,
        client_id: deps.clientId,
      }).toString(),
    },
    deps.fetch,
  );

  // A fault that could clear on its own is worth another poll; an answer WorkOS
  // meant is not. Keeping them apart is what lets the poller ride out a dropped
  // request or a bad gateway instead of stranding someone who has already
  // approved in the browser.
  if (outcome.kind === "failure") {
    return outcome.retryable
      ? { kind: "unreachable", detail: outcome.detail }
      : { kind: "error", detail: outcome.detail };
  }

  if (outcome.kind === "oauth-error") {
    switch (outcome.code) {
      case "authorization_pending":
        return { kind: "pending" };
      case "slow_down":
        return { kind: "slow-down" };
      case "access_denied":
        return { kind: "denied" };
      // WorkOS documents expired_token for a lapsed device code, per RFC 8628,
      // and reserves invalid_grant for one that is "invalid, malformed, or has
      // already been used". The only device code this ever sends is one WorkOS
      // just issued and has not redeemed, so expiry is the cause worth naming
      // for both.
      case "expired_token":
      case "invalid_grant":
        return { kind: "expired" };
      default:
        return {
          kind: "error",
          detail: outcome.description ?? outcome.code,
        };
    }
  }

  const parsed = deviceTokenBody.safeParse(outcome.json);
  if (!parsed.success) {
    return { kind: "error", detail: unexpectedResponse };
  }

  return {
    kind: "tokens",
    tokens: {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: readAccessTokenExpiry(parsed.data.access_token),
      email: parsed.data.user.email,
      organizationId: parsed.data.organization_id,
    },
  };
}
