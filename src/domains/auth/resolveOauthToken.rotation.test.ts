import { describe, expect, it, mock } from "bun:test";

import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { testIssuer, testResource } from "./binding.testUtils.js";
import {
  resolveOauthToken,
  type ResolveOauthTokenDeps,
} from "./resolveOauthToken.js";
import {
  boundToken,
  environmentToken,
  expectedRefreshArgs,
  makeDeps,
  nowMs,
  refreshed,
  stored,
} from "./resolveOauthToken.testUtils.js";
import type { StoredSession } from "./types.js";

describe("resolveOauthToken across renewals", () => {
  // Observed live: a refresh that omits `resource` answers with the environment
  // audience. Such a token must never reach the API, whatever else happened.
  it("rejects a refreshed token that carries the wrong audience", async () => {
    const { deps, saveTokens } = makeDeps(
      {
        found: true,
        tokens: { ...stored, expiresAt: nowMs - 1 },
        source: "keychain",
      },
      [
        {
          ok: true,
          value: {
            ...refreshed,
            accessToken: environmentToken(nowMs + 600_000),
          },
        },
      ],
    );

    const result = await resolveOauthToken("/config", deps);

    expect(result).toBeUndefined();
    // The rotation still happened, so the replacement refresh token is kept:
    // dropping it would lock every later attempt out as well.
    expect(saveTokens).toHaveBeenCalledTimes(1);
  });

  it("chains two rotations, each spending the token the last one issued", async () => {
    const second: DeviceTokens = {
      accessToken: boundToken("third", nowMs + 1_200_000),
      refreshToken: "refresh_third",
      expiresAt: nowMs + 1_200_000,
      organizationId: "org_1",
    };
    let onDisk: StoredSession = { ...stored, expiresAt: nowMs - 1 };
    const refreshTokens = mock(
      async (args: Parameters<ResolveOauthTokenDeps["refreshTokens"]>[0]) =>
        args.refreshToken === "refresh_old"
          ? { ok: true as const, value: refreshed }
          : { ok: true as const, value: second },
    );
    const deps: ResolveOauthTokenDeps = {
      loadTokens: async () => ({
        found: true,
        tokens: onDisk,
        source: "keychain",
      }),
      refreshTokens,
      saveTokens: async (_dir, tokens) => {
        onDisk = tokens;
      },
      now: () => nowMs,
      resource: testResource,
    };

    const first = await resolveOauthToken("/config", deps);
    // Force the second renewal: the pair on disk is now spent by fiat.
    onDisk = { ...onDisk, expiresAt: nowMs - 1 };
    const next = await resolveOauthToken("/config", deps);

    expect(first?.key).toBe(refreshed.accessToken);
    expect(next?.key).toBe(second.accessToken);
    expect(refreshTokens.mock.calls.map(([args]) => args)).toEqual([
      expectedRefreshArgs,
      { ...expectedRefreshArgs, refreshToken: "refresh_new" },
    ]);
    expect(onDisk.refreshToken).toBe("refresh_third");
    expect(onDisk.issuer).toBe(testIssuer);
    expect(onDisk.resource).toBe(testResource);
    expect(onDisk.email).toBe("person@example.com");
  });

  // Pointing the CLI at another deployment must not present — or spend — the
  // session that belongs to the previous one.
  it("ignores a session bound to a different deployment", async () => {
    const { deps, refreshTokens } = makeDeps({
      found: true,
      tokens: stored,
      source: "keychain",
    });

    const result = await resolveOauthToken("/config", {
      ...deps,
      resource: "https://elsewhere.example/api",
    });

    expect(result).toBeUndefined();
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  // Nothing to fall back to and nothing to retry: the resource is not
  // registered, which no amount of signing in changes.
  it("returns undefined, once, when the resource is not registered", async () => {
    const { deps, refreshTokens } = makeDeps(
      {
        found: true,
        tokens: { ...stored, expiresAt: nowMs - 1 },
        source: "file",
      },
      [{ ok: false, error: "invalid_target", retryable: false }],
    );

    const result = await resolveOauthToken("/config", deps);

    expect(result).toBeUndefined();
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });
});
