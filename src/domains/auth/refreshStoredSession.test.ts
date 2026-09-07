import { describe, expect, it, mock } from "bun:test";

import { makeJwt, testIssuer, testResource } from "./binding.testUtils.js";
import { refreshStoredSession } from "./refreshStoredSession.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

function boundToken(label: string, exp: number): string {
  return makeJwt({
    iss: testIssuer,
    aud: testResource,
    exp,
    org_id: "org_1",
    label,
  });
}

const spent: StoredSession = {
  accessToken: boundToken("spent", 1),
  refreshToken: "refresh_spent",
  expiresAt: 1,
  email: "person@example.com",
  organizationId: "org_1",
  issuer: testIssuer,
  clientId: "client_1",
  resource: testResource,
  workspaceId: "ws_1",
};

const rotated: StoredSession = {
  ...spent,
  accessToken: boundToken("fresh", 9_999_999_999),
  refreshToken: "refresh_rotated",
  expiresAt: 9_999_999_999_999,
};

/** Loads `first` once, then `after` for every later read. */
function loadsThen(first: StoredSession, after: StoredSession) {
  const loadTokens = mock(async () => found(after));
  loadTokens.mockResolvedValueOnce(found(first));
  return loadTokens;
}

const fs = {} as never;

function found(tokens: StoredSession): LoadTokensResult {
  return { found: true, tokens, source: "keychain" };
}

describe("refreshStoredSession", () => {
  it("reports a machine that has never signed in", async () => {
    const result = await refreshStoredSession("/config", fs, {
      loadTokens: async () => ({ found: false }),
      resolveOauth: async () => undefined,
    });

    expect(result).toEqual({ kind: "not-signed-in" });
  });

  it("reports a session that could not be renewed", async () => {
    const result = await refreshStoredSession("/config", fs, {
      loadTokens: async () => found(spent),
      resolveOauth: async () => undefined,
    });

    expect(result).toEqual({ kind: "refresh-failed" });
  });

  // The whole point of the read-back: the refresh rotates the pair and writes
  // it, so returning the copy loaded before the refresh would hand a spent
  // refresh token to whatever saves next.
  it("returns the rotated pair, not the one loaded before the refresh", async () => {
    const loadTokens = mock(async () => found(spent));
    loadTokens.mockResolvedValueOnce(found(spent));
    loadTokens.mockResolvedValueOnce(found(rotated));

    const result = await refreshStoredSession("/config", fs, {
      loadTokens,
      resolveOauth: async () => ({
        key: rotated.accessToken,
        email: rotated.email,
        workspaceId: rotated.workspaceId,
      }),
    });

    if (result.kind !== "session") throw Error("expected a session");
    expect(result.session.refreshToken).toBe("refresh_rotated");
    expect(result.session.accessToken).toBe(rotated.accessToken);
    expect(loadTokens).toHaveBeenCalledTimes(2);
  });

  // The store is shared. A sign-in that lands between the two reads belongs to
  // whoever signed in, and a workspace chosen on it would be written into
  // their session.
  it("refuses a session that belongs to someone else by the time it is reread", async () => {
    const result = await refreshStoredSession("/config", fs, {
      loadTokens: loadsThen(spent, {
        ...rotated,
        email: "someone-else@example.com",
      }),
      resolveOauth: async () => ({
        key: rotated.accessToken,
        email: rotated.email,
        workspaceId: rotated.workspaceId,
      }),
    });

    expect(result).toEqual({ kind: "refresh-failed" });
  });

  it("refuses a reread session whose token is not bound to the API", async () => {
    const result = await refreshStoredSession("/config", fs, {
      loadTokens: loadsThen(spent, {
        ...rotated,
        accessToken: makeJwt({ iss: testIssuer, aud: "client_01ENV", exp: 9 }),
      }),
      resolveOauth: async () => ({
        key: rotated.accessToken,
        email: rotated.email,
        workspaceId: rotated.workspaceId,
      }),
    });

    expect(result).toEqual({ kind: "refresh-failed" });
  });

  it("renews before handing the session back", async () => {
    const calls: string[] = [];
    const result = await refreshStoredSession("/config", fs, {
      loadTokens: async () => {
        calls.push("load");
        return found(rotated);
      },
      resolveOauth: async () => {
        calls.push("refresh");
        return {
          key: rotated.accessToken,
          email: rotated.email,
          workspaceId: rotated.workspaceId,
        };
      },
    });

    expect(result.kind).toBe("session");
    expect(calls).toEqual(["load", "refresh", "load"]);
  });
});
