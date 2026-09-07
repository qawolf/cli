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
 * session and still usable: the same deployment, the same organization, a
 * token the API would take, and one that has not already expired. Another
 * command aimed elsewhere writes to the same store, and a pair that sat there
 * long enough to lapse is no better than the one that failed to refresh.
 */
export function isAdoptable(
  candidate: StoredSession,
  session: StoredSession,
  nowMs: number,
): boolean {
  return (
    candidate.resource === session.resource &&
    candidate.organizationId === session.organizationId &&
    candidate.expiresAt !== undefined &&
    candidate.expiresAt > nowMs &&
    isBound(candidate)
  );
}
