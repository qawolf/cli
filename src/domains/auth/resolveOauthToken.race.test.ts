import { describe, expect, it, mock } from "bun:test";

import { makeJwt, testIssuer, testResource } from "./binding.testUtils.js";
import { resolveOauthToken } from "./resolveOauthToken.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

const nowMs = 1_700_000_000_000;

function boundToken(label: string, expiresAt: number, orgId = "org_1") {
  return makeJwt({
    iss: testIssuer,
    aud: testResource,
    exp: expiresAt / 1_000,
    org_id: orgId,
    label,
  });
}

const spent: StoredSession = {
  accessToken: boundToken("old", nowMs - 1),
  refreshToken: "refresh_stale",
  // Already past the margin, so resolving it always attempts a refresh.
  expiresAt: nowMs - 1,
  email: "person@example.com",
  organizationId: "org_1",
  issuer: testIssuer,
  clientId: "client_1",
  resource: testResource,
};

const winner: StoredSession = {
  ...spent,
  accessToken: boundToken("winner", nowMs + 600_000),
  refreshToken: "refresh_rotated",
  expiresAt: nowMs + 600_000,
};

function found(tokens: StoredSession): LoadTokensResult {
  return { found: true, tokens, source: "keychain" };
}

const revoked = async () => ({
  ok: false as const,
  error: "invalid_grant",
  retryable: false,
});

/** Loads `first` once, then `after` for every later read. */
function loadsThen(first: StoredSession, after: StoredSession) {
  const loadTokens = mock(async () => found(after));
  loadTokens.mockResolvedValueOnce(found(first));
  return loadTokens;
}

describe("resolveOauthToken when a refresh does not succeed", () => {
  // A lost refresh race must not read as "signed out". WorkOS rotates on every
  // exchange, so whichever process won has already written a pair this one can
  // use.
  it("adopts a pair another command installed while this refresh failed", async () => {
    const loadTokens = loadsThen(spent, winner);

    const result = await resolveOauthToken("/config", {
      loadTokens,
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
      resource: testResource,
    });

    expect(result).toEqual({
      key: winner.accessToken,
      email: "person@example.com",
    });
    expect(loadTokens).toHaveBeenCalledTimes(2);
  });

  // The pair on disk may have been written by a command aimed elsewhere, or
  // granted for another organization. Neither is this command's session.
  it.each([
    [
      "another deployment",
      { ...winner, resource: "https://elsewhere.example/api" },
    ],
    [
      "another organization",
      {
        ...winner,
        organizationId: "org_2",
        accessToken: boundToken("winner", nowMs + 600_000, "org_2"),
      },
    ],
    [
      "a pair that has itself already expired",
      {
        ...winner,
        accessToken: boundToken("winner", nowMs - 1),
        expiresAt: nowMs - 1,
      },
    ],
    [
      "an audience the API refuses",
      {
        ...winner,
        accessToken: makeJwt({ iss: testIssuer, aud: "client_01ENV", exp: 1 }),
      },
    ],
  ] satisfies [string, StoredSession][])(
    "does not adopt a pair bound to %s",
    async (_label, onDisk) => {
      const result = await resolveOauthToken("/config", {
        loadTokens: loadsThen(spent, onDisk),
        refreshTokens: revoked,
        saveTokens: async () => {},
        now: () => nowMs,
        resource: testResource,
      });

      expect(result).toBeUndefined();
    },
  );

  // The margin is a head start, not an expiry: the token in hand still works,
  // so a dropped packet inside it must not end the session.
  it("keeps an unexpired token when the refresh fails transiently", async () => {
    const insideMargin: StoredSession = {
      ...spent,
      accessToken: boundToken("still-good", nowMs + 5_000),
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
      resource: testResource,
    });

    expect(result?.key).toBe(insideMargin.accessToken);
  });

  // The fallback is only worth taking if the token in hand would be accepted.
  it("does not fall back to an unexpired token with the wrong audience", async () => {
    const wrongAudience: StoredSession = {
      ...spent,
      accessToken: makeJwt({
        iss: testIssuer,
        aud: "client_01ENV",
        exp: (nowMs + 5_000) / 1_000,
      }),
      expiresAt: nowMs + 5_000,
    };

    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(wrongAudience),
      refreshTokens: async () => ({
        ok: false as const,
        error: "socket hang up",
        retryable: true,
      }),
      saveTokens: async () => {},
      now: () => nowMs,
      resource: testResource,
    });

    expect(result).toBeUndefined();
  });

  // A write that fails costs the next command a sign-in either way; failing
  // this one as well would only take away a credential that works.
  it("returns the refreshed token even when it cannot be persisted", async () => {
    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(spent),
      refreshTokens: async () => ({
        ok: true as const,
        value: {
          accessToken: winner.accessToken,
          refreshToken: "refresh_new",
          expiresAt: nowMs + 600_000,
          organizationId: "org_1",
        },
      }),
      saveTokens: async () => {
        throw Object.assign(Error("permission denied"), { code: "EACCES" });
      },
      now: () => nowMs,
      resource: testResource,
    });

    expect(result?.key).toBe(winner.accessToken);
  });

  it("still reports nothing when the stored pair is unchanged", async () => {
    const result = await resolveOauthToken("/config", {
      loadTokens: async () => found(spent),
      refreshTokens: revoked,
      saveTokens: async () => {},
      now: () => nowMs,
      resource: testResource,
    });

    expect(result).toBeUndefined();
  });
});
