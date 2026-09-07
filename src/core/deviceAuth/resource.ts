/**
 * The API resource a deployment's tokens must be bound to: its origin followed
 * by `/api`. The API derives the same string from its own configured origin, so
 * scheme, host and port all have to agree, and `/api/` is a different string.
 */
export function apiResource(hostUrl: string): string {
  return new URL("/api", hostUrl).href;
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Issuers compare as strings once a trailing slash is discounted. Anything
 * looser — case folding, resolving a path — would let one server's metadata
 * or token pass for another's.
 */
export function sameIssuer(a: string, b: string): boolean {
  return withoutTrailingSlash(a) === withoutTrailingSlash(b);
}
