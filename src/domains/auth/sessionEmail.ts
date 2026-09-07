import { authErrorMessages } from "~/core/messages/authErrors.js";
import { describeIdentityError } from "~/shell/platform/describeErrors.js";
import { getIdentity } from "~/shell/platform/getIdentity.js";

type Deps = {
  fetch: typeof globalThis.fetch;
  baseUrl: string;
};

/**
 * Who a freshly bound token belongs to, according to the API. A Connect token
 * response names nobody, and the API's acceptance is the real test of the
 * token anyway, so the two questions are asked in one round trip.
 */
export async function fetchSessionEmail(
  accessToken: string,
  deps: Deps,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const identity = await getIdentity(accessToken, deps);
  if (!identity.ok) {
    return { ok: false, error: describeIdentityError(identity.error).error };
  }

  if (!("user" in identity.data)) {
    return { ok: false, error: authErrorMessages.identity.notUserSession };
  }

  return { ok: true, email: identity.data.user.email };
}
