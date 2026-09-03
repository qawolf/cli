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
    { ok: true; value: DeviceTokens } | { ok: false; error: string }
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
  if (!refreshed.ok) return undefined;

  // Refresh tokens rotate, so the whole pair has to land in storage. Persisting
  // only the access token would spend the refresh token and lock the next
  // refresh out. The chosen workspace is carried across, because a refresh
  // renews the credential rather than changing where the person is working.
  await deps.saveTokens(configDir, {
    ...refreshed.value,
    clientId: tokens.clientId,
  });

  return { key: refreshed.value.accessToken, email: refreshed.value.email };
}
