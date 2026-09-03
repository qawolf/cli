import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { isBound, isSameSession } from "./sessionBinding.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

/**
 * A token valid for another second will have expired by the time a slow
 * request reaches the API, and the resulting 401 looks like a bug.
 */
export const expiryMarginMs = 30_000;

export type ResolveOauthTokenDeps = {
  loadTokens: (configDir: string) => Promise<LoadTokensResult>;
  refreshTokens: (args: {
    refreshToken: string;
    issuer: string;
    clientId: string;
    resource: string;
  }) => Promise<
    | { ok: true; value: DeviceTokens }
    | { ok: false; error: string; retryable: boolean }
  >;
  saveTokens: (configDir: string, tokens: StoredSession) => Promise<unknown>;
  now: () => number;
  /** The API resource of the deployment the CLI is aimed at right now. */
  resource: string;
};

export type OauthToken = {
  key: string;
  email: string;
  workspaceId: string | undefined;
};

/**
 * Undefined whenever a token cannot be produced. A failed refresh means "sign
 * in again", which the caller reports as not authenticated rather than as an
 * error.
 */
export async function resolveOauthToken(
  configDir: string,
  deps: ResolveOauthTokenDeps,
): Promise<OauthToken | undefined> {
  const stored = await deps.loadTokens(configDir);
  if (!stored.found) return undefined;

  const { tokens } = stored;
  // A session belongs to the deployment it was bound to. Presenting it to
  // another would be refused, and refreshing it would spend the other
  // deployment's session for nothing.
  if (tokens.resource !== deps.resource) return undefined;

  const expiresAt = tokens.expiresAt;
  const unexpired = expiresAt !== undefined && expiresAt > deps.now();
  const isFresh =
    expiresAt !== undefined && expiresAt - expiryMarginMs > deps.now();

  if (isFresh && isBound(tokens)) {
    return {
      key: tokens.accessToken,
      email: tokens.email,
      workspaceId: tokens.workspaceId,
    };
  }

  // The resource goes on every refresh: without it WorkOS answers with the
  // environment audience again, and the session ends on the next request.
  const refreshed = await deps.refreshTokens({
    refreshToken: tokens.refreshToken,
    issuer: tokens.issuer,
    clientId: tokens.clientId,
    resource: tokens.resource,
  });
  if (!refreshed.ok) {
    // The margin is a head start, not an expiry. A dropped packet inside it
    // leaves a token that still works, so ending the session over one would
    // sign someone out mid-command for nothing.
    if (refreshed.retryable && unexpired && isBound(tokens)) {
      return {
        key: tokens.accessToken,
        email: tokens.email,
        workspaceId: tokens.workspaceId,
      };
    }

    // Another command may have refreshed while this one was in flight — the
    // workers of a single `flows run` all resolve at once. Adopt whatever is on
    // disk before reporting a dead session: the winner's pair is valid for this
    // process too, and reporting "not authenticated" over a lost race sends
    // someone to sign in again for nothing.
    const current = await deps.loadTokens(configDir);
    if (
      current.found &&
      current.tokens.refreshToken !== tokens.refreshToken &&
      isSameSession(current.tokens, tokens)
    ) {
      return {
        key: current.tokens.accessToken,
        email: current.tokens.email,
        workspaceId: current.tokens.workspaceId,
      };
    }
    return undefined;
  }

  const renewed: StoredSession = {
    ...refreshed.value,
    email: tokens.email,
    workspaceId: tokens.workspaceId,
    issuer: tokens.issuer,
    clientId: tokens.clientId,
    resource: tokens.resource,
  };

  // Refresh tokens rotate, so the whole pair has to land in storage. Persisting
  // only the access token would spend the refresh token and lock the next
  // refresh out. Saved before the audience check for the same reason: the
  // rotation has happened whether or not the token turns out usable.
  try {
    await deps.saveTokens(configDir, renewed);
  } catch {
    // The token in hand works for this command. Failing here as well would cost
    // the caller a working credential and change nothing: the refresh already
    // spent the stored token, so the next command has to sign in again whether
    // this one succeeds or not.
  }

  // Never present a token the API would refuse; the person would see an
  // opaque 401 in place of a reason.
  if (!isBound(renewed)) return undefined;

  return {
    key: renewed.accessToken,
    email: renewed.email,
    workspaceId: renewed.workspaceId,
  };
}
