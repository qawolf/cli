import { readTokenClaims } from "./tokenClaims.js";

/**
 * Epoch milliseconds from the `exp` claim inside the token, which is the only
 * expiry a token response reliably carries. Undefined for anything malformed —
 * an unreadable expiry means "refresh it", not "crash the command".
 */
export function readAccessTokenExpiry(accessToken: string): number | undefined {
  const exp = readTokenClaims(accessToken)?.["exp"];
  if (typeof exp !== "number" || !Number.isFinite(exp)) return undefined;

  return exp * 1_000;
}
