import { describe, expect, it, mock } from "bun:test";

import type { LoadTokensResult, StoredSession } from "~/domains/auth/types.js";
import { saveWorkspaceId } from "./saveWorkspaceId.js";

function makeSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    accessToken: "access_1",
    refreshToken: "refresh_1",
    expiresAt: 1_700_000_000_000,
    email: "person@example.com",
    organizationId: "org_1",
    workspaceId: undefined,
    clientId: "client_123",
    ...overrides,
  };
}

function makeDeps(stored: LoadTokensResult) {
  const saveTokens = mock(async (_session: StoredSession) => ({
    stored: "keychain" as const,
  }));
  return {
    saveTokens,
    deps: {
      loadTokens: async () => stored,
      saveTokens,
    },
  };
}

describe("saveWorkspaceId", () => {
  it("writes the choice onto the pair that is stored now, not the captured one", async () => {
    // A renewal in another process rotated the pair while the person chose.
    const rotated = makeSession({
      accessToken: "access_2",
      refreshToken: "refresh_2",
      expiresAt: 1_700_003_600_000,
    });
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: rotated,
      source: "keychain",
    });

    await saveWorkspaceId(makeSession(), "ws_1", deps);

    expect(saveTokens).toHaveBeenCalledWith({
      ...rotated,
      workspaceId: "ws_1",
    });
  });

  it("replaces a workspace the session already recorded", async () => {
    const stored = makeSession({ workspaceId: "ws_old" });
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: stored,
      source: "file",
    });

    await saveWorkspaceId(stored, "ws_new", deps);

    expect(saveTokens).toHaveBeenCalledWith({
      ...stored,
      workspaceId: "ws_new",
    });
  });

  it("refuses when another account signed in while the person chose", async () => {
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: makeSession({ email: "other@example.com" }),
      source: "keychain",
    });

    let caught: unknown;
    try {
      await saveWorkspaceId(makeSession(), "ws_1", deps);
    } catch (err: unknown) {
      caught = err;
    }

    expect((caught as Error).message).toContain("stored sign-in changed");
    expect(saveTokens).not.toHaveBeenCalled();
  });

  it("refuses when the session moved to another organization", async () => {
    const { deps, saveTokens } = makeDeps({
      found: true,
      tokens: makeSession({ organizationId: "org_2" }),
      source: "keychain",
    });

    let caught: unknown;
    try {
      await saveWorkspaceId(makeSession(), "ws_1", deps);
    } catch (err: unknown) {
      caught = err;
    }

    expect((caught as Error).message).toContain("stored sign-in changed");
    expect(saveTokens).not.toHaveBeenCalled();
  });

  it("refuses when the store was emptied by a logout", async () => {
    const { deps, saveTokens } = makeDeps({ found: false });

    let caught: unknown;
    try {
      await saveWorkspaceId(makeSession(), "ws_1", deps);
    } catch (err: unknown) {
      caught = err;
    }

    expect((caught as Error).message).toContain("stored sign-in changed");
    expect(saveTokens).not.toHaveBeenCalled();
  });
});
