import type { DeviceAuthorization } from "~/core/deviceAuth/types.js";
import { sendWorkosRequest, unexpectedResponse } from "./send.js";
import {
  type AuthorizationResult,
  defaultIntervalSec,
  deviceAuthorizationBody,
  type WorkosDeps,
} from "./types.js";

/**
 * Starts a device flow. Note the content type: this endpoint takes JSON, while
 * the token endpoint it pairs with takes form encoding.
 */
export async function requestDeviceAuthorization(
  deps: WorkosDeps,
): Promise<AuthorizationResult<DeviceAuthorization>> {
  const outcome = await sendWorkosRequest(
    `${deps.baseUrl}/user_management/authorize/device`,
    {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: deps.clientId }),
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
