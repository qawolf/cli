import { describe, expect, it } from "bun:test";

import { testIssuer, testResource } from "./deviceLogin.testUtils.js";
import { expiryMarginMs, resolveOauthToken } from "./resolveOauthToken.js";
import {
  environmentToken,
  expectedRefreshArgs,
  makeDeps,
  nowMs,
  refreshed,
  stored,
} from "./resolveOauthToken.testUtils.js";

describe("resolveOauthToken", () => {
  it("uses the stored access token while it remains valid", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: stored,
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", deps);

    expect(result).toEqual({
      key: stored.accessToken,
      email: "person@example.com",
    });
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token with the session's own binding", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs - 1 },
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", deps);

    expect(result).toEqual({
      key: refreshed.accessToken,
      email: "person@example.com",
    });
    expect(refreshTokens).toHaveBeenCalledWith(expectedRefreshArgs);
  });

  it("refreshes a token that expires inside the safety margin", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs + expiryMarginMs - 1 },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledWith(expectedRefreshArgs);
  });

  it("refreshes when the stored expiry is unknown", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: undefined },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledWith(expectedRefreshArgs);
  });

  // An unexpired token is only worth presenting if it is bound to the API.
  // One stored with another audience would be refused, so it is renewed.
  it("refreshes an unexpired token that is not bound to the resource", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: { ...stored, accessToken: environmentToken(nowMs + 60_000) },
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", deps);

    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(result?.key).toBe(refreshed.accessToken);
  });

  it("persists the rotated pair together with the session's binding and email", async () => {
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: { ...stored, expiresAt: nowMs - 1 },
      source: "keychain",
    });

    await resolveOauthToken("/config", deps);

    expect(saveTokens).toHaveBeenCalledWith("/config", {
      ...refreshed,
      email: "person@example.com",
      issuer: testIssuer,
      clientId: "client_1",
      resource: testResource,
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
      [{ ok: false, error: "token revoked", retryable: false }],
    );

    const result = await resolveOauthToken("/config", deps);

    expect(result).toBeUndefined();
    expect(saveTokens).not.toHaveBeenCalled();
  });
});
