import { sameIssuer } from "./resource.js";

export type TokenClaims = Record<string, unknown>;

/**
 * The payload of a JWT, decoded without verifying the signature. The values
 * decide what the CLI does next — when to refresh, whether a token is worth
 * presenting — while the API remains the judge of whether a token is genuine.
 *
 * Undefined for anything that is not a three-segment token carrying a JSON
 * object: an unreadable token means "do not trust it", not "crash".
 */
export function readTokenClaims(token: string): TokenClaims | undefined {
  const segments = token.split(".");
  if (segments.length !== 3) return undefined;

  const [, payload] = segments;
  if (!payload) return undefined;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }

  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) {
    return undefined;
  }
  return claims as TokenClaims;
}

export type TokenBinding =
  | {
      ok: true;
      /** Epoch ms; absent when the token carried no readable expiry. */
      expiresAt: number | undefined;
      /** The `org_id` claim: the WorkOS organization the token is scoped to. */
      organizationId: string | undefined;
    }
  | {
      ok: false;
      reason: "malformed" | "issuer-mismatch" | "audience-mismatch";
    };

function readExpiry(claims: TokenClaims): number | undefined {
  const exp = claims["exp"];
  if (typeof exp !== "number" || !Number.isFinite(exp)) return undefined;
  return exp * 1_000;
}

function hasAudience(claims: TokenClaims, resource: string): boolean {
  const aud = claims["aud"];
  if (typeof aud === "string") return aud === resource;
  // An array is acceptable when it names the exact resource; a token issued
  // for both the API and MCP resources is still a token for the API.
  return Array.isArray(aud) && aud.includes(resource);
}

/**
 * Whether a token is one the API would accept: issued by the configured
 * issuer, for exactly the configured resource.
 *
 * A consistency check, not verification. Its purpose is to stop the CLI
 * presenting a token that is bound to something else — the live failure was
 * a device grant answering with the environment client id as the audience —
 * so the person sees a clear reason instead of an opaque 401.
 */
export function verifyTokenBinding(
  accessToken: string,
  binding: { issuer: string; resource: string },
): TokenBinding {
  const claims = readTokenClaims(accessToken);
  if (!claims) return { ok: false, reason: "malformed" };

  const iss = claims["iss"];
  if (typeof iss !== "string" || !sameIssuer(iss, binding.issuer)) {
    return { ok: false, reason: "issuer-mismatch" };
  }

  if (!hasAudience(claims, binding.resource)) {
    return { ok: false, reason: "audience-mismatch" };
  }

  const orgId = claims["org_id"];
  return {
    ok: true,
    expiresAt: readExpiry(claims),
    organizationId: typeof orgId === "string" && orgId ? orgId : undefined,
  };
}
