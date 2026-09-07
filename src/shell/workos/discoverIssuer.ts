import { sameIssuer } from "~/core/deviceAuth/resource.js";
import { errorMessage } from "~/core/errors.js";
import { authErrorMessages } from "~/core/messages/authErrors.js";
import { isTransientStatus, unexpectedResponse } from "./send.js";
import {
  type AuthorizationResult,
  authorizationServerMetadata,
  type IssuerEndpoints,
} from "./types.js";

const timeoutMs = 10_000;
const messages = authErrorMessages.workos.metadata;

/**
 * RFC 8414 section 3.1: the well-known segment goes between the origin and the
 * issuer's path, so `https://host/tenant` is served its metadata at
 * `https://host/.well-known/oauth-authorization-server/tenant`.
 */
function metadataUrl(issuer: string): string | undefined {
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    return undefined;
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}/.well-known/oauth-authorization-server${path}`;
}

function failure(
  error: string,
  retryable: boolean,
): AuthorizationResult<IssuerEndpoints> {
  return { ok: false, error, retryable };
}

/**
 * The endpoints will receive a device code and, later, every refresh token.
 * A document that pointed them at another origin — a legacy WorkOS host, or
 * anything else — would hand those over, so the origin has to be the issuer's.
 */
function onIssuerOrigin(endpoint: string, issuer: string): boolean {
  try {
    return new URL(endpoint).origin === new URL(issuer).origin;
  } catch {
    return false;
  }
}

/**
 * RFC 8414 discovery of the two grant endpoints, checked against the issuer
 * the deployment named. Read without credentials and without following
 * redirects: nothing about a redirect target has been vetted.
 */
export async function discoverIssuer(
  issuer: string,
  fetchFn: typeof globalThis.fetch,
): Promise<AuthorizationResult<IssuerEndpoints>> {
  const url = metadataUrl(issuer);
  if (!url) return failure(messages.invalidIssuer(issuer), false);

  let response: Response;
  try {
    response = await fetchFn(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err: unknown) {
    return failure(
      authErrorMessages.workos.unreachable(errorMessage(err)),
      true,
    );
  }

  if (response.status >= 300 && response.status < 400) {
    return failure(authErrorMessages.workos.redirected, false);
  }
  if (isTransientStatus(response.status)) {
    return failure(messages.unavailable(response.status), true);
  }
  if (!response.ok)
    return failure(messages.unavailable(response.status), false);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    // A 200 that is not JSON is a captive portal or a proxy answering in the
    // issuer's place, which the next attempt may get past.
    return failure(unexpectedResponse, true);
  }

  const parsed = authorizationServerMetadata.safeParse(json);
  if (!parsed.success) return failure(unexpectedResponse, false);

  const metadata = parsed.data;
  if (!sameIssuer(metadata.issuer, issuer)) {
    return failure(messages.issuerMismatch(issuer, metadata.issuer), false);
  }

  // Named by their metadata field, which is what an operator reading the
  // message would look for in the document.
  const advertised = [
    ["device_authorization_endpoint", metadata.device_authorization_endpoint],
    ["token_endpoint", metadata.token_endpoint],
  ] as const;
  for (const [field, endpoint] of advertised) {
    if (!endpoint) return failure(messages.missingEndpoint(field), false);
    if (!onIssuerOrigin(endpoint, issuer)) {
      return failure(messages.foreignEndpoint(field), false);
    }
  }
  if (!metadata.device_authorization_endpoint || !metadata.token_endpoint) {
    // Unreachable after the loop above; narrows the type without a cast.
    return failure(unexpectedResponse, false);
  }

  return {
    ok: true,
    value: {
      deviceAuthorization: metadata.device_authorization_endpoint,
      token: metadata.token_endpoint,
    },
  };
}
