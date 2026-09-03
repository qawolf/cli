import { defaultWorkosBaseUrl } from "./types.js";

export type WorkosConfig =
  | { configured: false }
  | { configured: true; clientId: string; baseUrl: string };

/**
 * No override by design: the client id is a fact about the deployment rather
 * than a preference, and a token verifies only against the client its backend
 * checks — a hand-supplied value could only disagree, failing later as an
 * opaque rejection.
 */
export function resolveWorkosConfig(
  publishedClientId: string | undefined,
): WorkosConfig {
  const clientId = publishedClientId?.trim();
  if (!clientId) return { configured: false };

  return { configured: true, clientId, baseUrl: defaultWorkosBaseUrl };
}
