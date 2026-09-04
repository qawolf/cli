import type { DeviceTokens } from "~/core/deviceAuth/types.js";
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
    organizationId: string | undefined;
    clientId: string | undefined;
  }) => Promise<
    | { ok: true; value: DeviceTokens }
    | { ok: false; error: string; retryable: boolean }
  >;
  saveTokens: (configDir: string, tokens: StoredSession) => Promise<unknown>;
  now: () => number;
};

export type OauthToken = { key: string; email: string };

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
  const expiresAt = tokens.expiresAt;
  const isFresh =
    expiresAt !== undefined && expiresAt - expiryMarginMs > deps.now();

  if (isFresh) {
    return { key: tokens.accessToken, email: tokens.email };
  }

  // Pin the refresh to the organization already in use. Without it WorkOS is
  // free to choose again, so a session could silently move between
  // organizations partway through a run of commands.
  const refreshed = await deps.refreshTokens({
    refreshToken: tokens.refreshToken,
    organizationId: tokens.organizationId,
    clientId: tokens.clientId,
  });
  if (!refreshed.ok) {
    // The margin is a head start, not an expiry. A dropped packet inside it
    // leaves a token that still works, so ending the session over one would
    // sign someone out mid-command for nothing.
    if (
      refreshed.retryable &&
      expiresAt !== undefined &&
      expiresAt > deps.now()
    ) {
      return { key: tokens.accessToken, email: tokens.email };
    }

    // Another command may have refreshed while this one was in flight — the
    // workers of a single `flows run` all resolve at once. Adopt whatever is on
    // disk before reporting a dead session: the winner's pair is valid for this
    // process too, and reporting "not authenticated" over a lost race sends
    // someone to sign in again for nothing.
    const current = await deps.loadTokens(configDir);
    if (current.found && current.tokens.refreshToken !== tokens.refreshToken) {
      return {
        key: current.tokens.accessToken,
        email: current.tokens.email,
      };
    }
    return undefined;
  }

  // Refresh tokens rotate, so the whole pair has to land in storage. Persisting
  // only the access token would spend the refresh token and lock the next
  // refresh out.
  try {
    await deps.saveTokens(configDir, {
      ...refreshed.value,
      clientId: tokens.clientId,
    });
  } catch {
    // The token in hand works for this command. Failing here as well would cost
    // the caller a working credential and change nothing: the refresh already
    // spent the stored token, so the next command has to sign in again whether
    // this one succeeds or not.
  }

  return { key: refreshed.value.accessToken, email: refreshed.value.email };
}
