import type { DeviceAuthorization } from "~/core/deviceAuth/types.js";
import { sendWorkosRequest, unexpectedResponse } from "./send.js";
import {
  type AuthorizationResult,
  defaultIntervalSec,
  deviceAuthorizationBody,
  type WorkosDeps,
} from "./types.js";

/**
 * Starts a device flow. Form encoded, like the token endpoint it pairs with:
 * that is the encoding WorkOS documents for both, so neither depends on the
 * server being more permissive than its contract.
 */
export async function requestDeviceAuthorization(
  deps: WorkosDeps,
): Promise<AuthorizationResult<DeviceAuthorization>> {
  const outcome = await sendWorkosRequest(
    `${deps.baseUrl}/user_management/authorize/device`,
    {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: deps.clientId }).toString(),
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

  const parsed = deviceAuthorizationBody.safeParse(outcome.json);
  if (!parsed.success) {
    return { ok: false, error: unexpectedResponse, retryable: false };
  }

  return {
    ok: true,
    value: {
      deviceCode: parsed.data.device_code,
      userCode: parsed.data.user_code,
      verificationUri: parsed.data.verification_uri,
      verificationUriComplete: parsed.data.verification_uri_complete,
      expiresInSec: parsed.data.expires_in,
      intervalSec: parsed.data.interval ?? defaultIntervalSec,
    },
  };
}
