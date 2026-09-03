/**
 * Epoch milliseconds. The device token response carries no `expires_in`, so the
 * only expiry available is the `exp` claim inside the token. Decoded without
 * verifying the signature: the value decides when to refresh, and the API
 * judges whether a token is genuine.
 *
 * Undefined for anything malformed — an unreadable expiry means "refresh it",
 * not "crash the command".
 */
export function readAccessTokenExpiry(accessToken: string): number | undefined {
  const segments = accessToken.split(".");
  if (segments.length !== 3) return undefined;

  const [, payload] = segments;
  if (!payload) return undefined;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }

  if (typeof claims !== "object" || claims === null) return undefined;

  const exp = (claims as { exp?: unknown }).exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return undefined;

  return exp * 1_000;
}
