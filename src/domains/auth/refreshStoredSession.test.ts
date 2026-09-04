import { describe, expect, it, mock } from "bun:test";

import { refreshStoredSession } from "./refreshStoredSession.js";
import type { LoadTokensResult, StoredSession } from "./types.js";

const spent: StoredSession = {
  accessToken: "access_spent",
  refreshToken: "refresh_spent",
  expiresAt: 1,
  email: "person@example.com",
  organizationId: "org_1",
  issuer: "https://signin.example",
  clientId: "client_1",
  resource: "https://app.example/api",
  workspaceId: "ws_1",
};

const rotated: StoredSession = {
  ...spent,
  accessToken: "access_fresh",
  refreshToken: "refresh_rotated",
  expiresAt: 9_999_999_999_999,
};

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
    expect(result.session.accessToken).toBe("access_fresh");
    expect(loadTokens).toHaveBeenCalledTimes(2);
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
