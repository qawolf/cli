import { describe, expect, it, mock } from "bun:test";

import { resolveOauthToken } from "./resolveOauthToken.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

const nowMs = 1_700_000_000_000;

const spent: StoredSession = {
  accessToken: "access_old",
  refreshToken: "refresh_stale",
  // Already past the margin, so resolving it always attempts a refresh.
  expiresAt: nowMs - 1,
  email: "person@example.com",
  organizationId: "org_1",
  workspaceId: undefined,
  clientId: "client_1",
};

function found(tokens: StoredSession): LoadTokensResult {
  return { found: true, tokens, source: "keychain" };
}

const revoked = async () => ({
  ok: false as const,
  error: "invalid_grant",
  retryable: false,
});

describe("resolveOauthToken when a refresh does not succeed", () => {
  // A lost refresh race must not read as "signed out". WorkOS rotates on every
  // exchange, so whichever process won has already written a pair this one can
  // use.
  it("adopts a pair another command installed while this refresh failed", async () => {
    const winner: StoredSession = {
      ...spent,
      accessToken: "access_from_winner",
      refreshToken: "refresh_rotated",
      expiresAt: nowMs + 600_000,
      // The adopted pair brings its workspace with it, so the command that lost
      // the race keeps working where the person chose.
      workspaceId: "ws_1",
    };
    const loadTokens = mock(async () => found(winner));
    loadTokens.mockResolvedValueOnce(found(spent));

    const result = await resolveOauthToken("/config", {
      loadTokens,
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toEqual({
      key: "access_from_winner",
      email: "person@example.com",
      workspaceId: "ws_1",
    });
    expect(loadTokens).toHaveBeenCalledTimes(2);
  });

  // The store is shared. A pair written there by another person's sign-in is
  // not this command's session, whatever its refresh token says.
  it("does not adopt another account's pair", async () => {
    const theirs: StoredSession = {
      ...spent,
      accessToken: "access_theirs",
      refreshToken: "refresh_theirs",
      expiresAt: nowMs + 600_000,
      email: "someone-else@example.com",
    };
    const loadTokens = mock(async () => found(theirs));
    loadTokens.mockResolvedValueOnce(found(spent));

    const result = await resolveOauthToken("/config", {
      loadTokens,
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toBeUndefined();
  });

  it("does not adopt a replacement pair that has itself already expired", async () => {
    const stale: StoredSession = {
      ...spent,
      accessToken: "access_from_winner",
      refreshToken: "refresh_rotated",
      expiresAt: nowMs - 1,
    };
    const loadTokens = mock(async () => found(stale));
    loadTokens.mockResolvedValueOnce(found(spent));

    const result = await resolveOauthToken("/config", {
      loadTokens,
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toBeUndefined();
  });

  // The margin is a head start, not an expiry: the token in hand still works,
  // so a dropped packet inside it must not end the session.
  it("keeps an unexpired token when the refresh fails transiently", async () => {
    const insideMargin: StoredSession = {
      ...spent,
      accessToken: "access_still_good",
      expiresAt: nowMs + 5_000,
    };

    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(insideMargin),
      refreshTokens: async () => ({
        ok: false as const,
        error: "socket hang up",
        retryable: true,
      }),
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result?.key).toBe("access_still_good");
  });

  // A write that fails costs the next command a sign-in either way; failing
  // this one as well would only take away a credential that works.
  it("returns the refreshed token even when it cannot be persisted", async () => {
    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(spent),
      refreshTokens: async () => ({
        ok: true as const,
        value: {
          accessToken: "access_new",
          refreshToken: "refresh_new",
          expiresAt: nowMs + 600_000,
          email: "person@example.com",
          organizationId: "org_1",
        },
      }),
      saveTokens: async () => {
        throw Object.assign(Error("permission denied"), { code: "EACCES" });
      },
      now: () => nowMs,
    });

    expect(result?.key).toBe("access_new");
  });

  it("still reports nothing when the stored pair is unchanged", async () => {
    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(spent),
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toBeUndefined();
  });
});
