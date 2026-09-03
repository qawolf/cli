import { verifyTokenBinding } from "~/core/deviceAuth/tokenClaims.js";
import type { StoredSession } from "./types.js";

/** Whether the API would accept this session's access token as it stands. */
export function isBound(session: StoredSession): boolean {
  return verifyTokenBinding(session.accessToken, {
    issuer: session.issuer,
    resource: session.resource,
  }).ok;
}

/**
 * Whether a pair found on disk after a failed refresh is this command's
 * session: the same deployment, the same organization, and a token the API
 * would take. Another command aimed elsewhere writes to the same store.
 */
export function isSameSession(
  candidate: StoredSession,
  session: StoredSession,
): boolean {
  return (
    candidate.resource === session.resource &&
    candidate.organizationId === session.organizationId &&
    isBound(candidate)
  );
}
