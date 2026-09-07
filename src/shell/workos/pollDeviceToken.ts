import type { PollResponse } from "~/core/deviceAuth/types.js";
import { readConnectTokens } from "./connectTokens.js";
import { sendWorkosRequest } from "./send.js";
import type { WorkosDeps } from "./types.js";

const deviceCodeGrantType = "urn:ietf:params:oauth:grant-type:device_code";

/**
 * One attempt at redeeming a device code, translated from OAuth wire codes into
 * the vocabulary the pure state machine understands. Looping and backing off
 * are the caller's job.
 *
 * The token this yields is not yet one the API accepts: WorkOS answered the
 * device grant with the environment client id as the audience whatever
 * `resource` asked for. The refresh that follows is what binds it.
 */
export async function pollDeviceToken(
  deviceCode: string,
  deps: WorkosDeps,
): Promise<PollResponse> {
  const outcome = await sendWorkosRequest(
    deps.endpoints.token,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: deps.clientId,
        grant_type: deviceCodeGrantType,
        device_code: deviceCode,
        resource: deps.resource,
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

  const tokens = readConnectTokens(outcome.json);
  if (!tokens.ok) return { kind: "error", detail: tokens.error };

  return { kind: "tokens", tokens: tokens.tokens };
}
