import { mock } from "bun:test";

import type { DeviceTokens } from "~/core/deviceAuth/types.js";
import { makeJwt, testIssuer, testResource } from "./deviceLogin.testUtils.js";
import type { ResolveOauthTokenDeps } from "./resolveOauthToken.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

export const nowMs = 1_700_000_000_000;

export function boundToken(
  label: string,
  expiresAt: number,
  orgId = "org_1",
): string {
  return makeJwt({
    iss: testIssuer,
    aud: testResource,
    exp: expiresAt / 1_000,
    org_id: orgId,
    label,
  });
}

/** What a refresh without `resource` answers with: the environment audience. */
export function environmentToken(expiresAt: number): string {
  return makeJwt({
    iss: testIssuer,
    aud: "client_01ENV",
    exp: expiresAt / 1_000,
    org_id: "org_1",
  });
}

export const stored: StoredSession = {
  accessToken: boundToken("old", nowMs + 60_000),
  refreshToken: "refresh_old",
  expiresAt: nowMs + 60_000,
  email: "person@example.com",
  organizationId: "org_1",
  issuer: testIssuer,
  clientId: "client_1",
  resource: testResource,
};

export const refreshed: DeviceTokens = {
  accessToken: boundToken("new", nowMs + 600_000),
  refreshToken: "refresh_new",
  expiresAt: nowMs + 600_000,
  organizationId: "org_1",
};

export const expectedRefreshArgs = {
  refreshToken: "refresh_old",
  issuer: testIssuer,
  clientId: "client_1",
  resource: testResource,
};

export type RefreshResult = Awaited<
  ReturnType<ResolveOauthTokenDeps["refreshTokens"]>
>;

export function makeDeps(
  loadResult: LoadTokensResult,
  refreshResults: RefreshResult[] = [{ ok: true, value: refreshed }],
) {
  const saveTokens = mock(
    async (_configDir: string, _tokens: StoredSession) => {
      // storage is asserted through the spy, not through a filesystem
    },
  );
  const refreshTokens = mock(
    async (_args: Parameters<ResolveOauthTokenDeps["refreshTokens"]>[0]) => {
      const next =
        refreshResults[
          Math.min(
            refreshTokens.mock.calls.length - 1,
            refreshResults.length - 1,
          )
        ];
      if (!next) throw Error("no scripted refresh result");
      return next;
    },
  );
  return {
    saveTokens,
    refreshTokens,
    deps: {
      loadTokens: async () => loadResult,
      refreshTokens,
      saveTokens,
      now: () => nowMs,
      resource: testResource,
    } satisfies ResolveOauthTokenDeps,
  };
}
