import { describe, expect, it, mock } from "bun:test";

import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { expiryMarginMs, resolveOauthToken } from "./resolveOauthToken.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

const nowMs = 1_700_000_000_000;

const stored: StoredSession = {
  accessToken: "access_old",
  refreshToken: "refresh_old",
  expiresAt: nowMs + 60_000,
  email: "person@example.com",
  organizationId: "org_1",
  clientId: "client_1",
};

const refreshed: DeviceTokens = {
  accessToken: "access_new",
  refreshToken: "refresh_new",
  expiresAt: nowMs + 600_000,
  email: "person@example.com",
  organizationId: "org_1",
};

function makeDeps(
  loadResult: LoadTokensResult,
  refreshResult:
    | { ok: true; value: DeviceTokens }
    | { ok: false; error: string } = { ok: true, value: refreshed },
) {
  const saveTokens = mock(async (_configDir: string, _tokens: DeviceTokens) => {
    // storage is asserted through the spy, not through a filesystem
  });
  const refreshTokens = mock(
    async (_args: {
      refreshToken: string;
      organizationId: string | undefined;
      clientId: string | undefined;
    }) => refreshResult,
  );
  return {
    saveTokens,
    refreshTokens,
    deps: {
      loadTokens: async () => loadResult,
      refreshTokens,
      saveTokens,
      now: () => nowMs,
    },
  };
}

describe("resolveOauthToken", () => {
  it("uses the stored access token while it remains valid", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: stored,
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", deps);

    expect(result).toEqual({
      key: "access_old",
      email: "person@example.com",
    });
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs - 1 },
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", deps);

    expect(result).toEqual({
      key: "access_new",
      email: "person@example.com",
    });
    expect(refreshTokens).toHaveBeenCalledWith({
      refreshToken: "refresh_old",
      organizationId: "org_1",
      clientId: "client_1",
    });
  });

  it("refreshes a token that expires inside the safety margin", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs + expiryMarginMs - 1 },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledWith({
      refreshToken: "refresh_old",
      organizationId: "org_1",
      clientId: "client_1",
    });
  });

  it("refreshes when the stored expiry is unknown", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: undefined },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledWith({
      refreshToken: "refresh_old",
      organizationId: "org_1",
      clientId: "client_1",
    });
  });

  it("asks for no particular organization when none was stored", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs - 1, organizationId: undefined },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledWith({
      refreshToken: "refresh_old",
      organizationId: undefined,
      clientId: "client_1",
    });
  });

  it("persists the rotated refresh token, not just the access token", async () => {
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs - 1 },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(saveTokens).toHaveBeenCalledWith("/config", {
      ...refreshed,
      clientId: "client_1",
    });
  });

  it("returns undefined when no tokens are stored", async () => {
    const { deps, refreshTokens } = makeDeps({ found: false });

    const result = await resolveOauthToken("/config", deps);

    expect(result).toBeUndefined();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("returns undefined when the refresh token has been revoked", async () => {
    const { deps, saveTokens } = makeDeps(
      {
        found: true,
        tokens: { ...stored, expiresAt: nowMs - 1 },
        source: "file",
      },
      { ok: false, error: "token revoked" },
    );

    const result = await resolveOauthToken("/config", deps);

    expect(result).toBeUndefined();
    expect(saveTokens).not.toHaveBeenCalled();
  });

  // A lost refresh race must not read as "signed out". WorkOS rotates on every
  // exchange, so whichever process won has already written a pair this one can
  // use.
  it("adopts a pair another command installed while this refresh failed", async () => {
    const stale: StoredSession = {
      ...stored,
      refreshToken: "refresh_stale",
      expiresAt: nowMs - 1,
    };
    const winner: StoredSession = {
      ...stored,
      accessToken: "access_from_winner",
      refreshToken: "refresh_rotated",
      expiresAt: nowMs + 600_000,
    };
    const loadTokens = mock(
      async (): Promise<LoadTokensResult> => ({
        found: true,
        tokens: winner,
        source: "keychain",
      }),
    );
    loadTokens.mockResolvedValueOnce({
      found: true,
      tokens: stale,
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", {
      loadTokens,
      refreshTokens: async () => ({
        ok: false as const,
        error: "invalid_grant",
      }),
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toEqual({
      key: "access_from_winner",
      email: "person@example.com",
    });
  });

  it("still reports nothing when the stored pair is unchanged", async () => {
    const stale: StoredSession = {
      ...stored,
      refreshToken: "refresh_stale",
      expiresAt: nowMs - 1,
    };

    const result = await resolveOauthToken("/config", {
      loadTokens: async () => ({
        found: true,
        tokens: stale,
        source: "keychain",
      }),
      refreshTokens: async () => ({
        ok: false as const,
        error: "invalid_grant",
      }),
      saveTokens: async () => {},
      now: () => nowMs,
    });

    expect(result).toBeUndefined();
  });
});
