import { describe, expect, it, mock } from "bun:test";

import { authMessages } from "~/core/messages/index.js";
import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/types.js";
import { handleSwitchWorkspace } from "./switchWorkspace.js";

function makeCtx(mode: UI["mode"]): CommandContext & { ui: UI } {
  return {
    ui: {
      mode,
      gap: mock(),
      intro: mock(),
      info: mock(),
      warn: mock(),
      error: mock(),
      outro: mock(),
    } as unknown as UI,
    configDir: "/config",
  } as unknown as CommandContext & { ui: UI };
}

describe("handleSwitchWorkspace", () => {
  it("refuses a non-interactive run that names no workspace", async () => {
    const ctx = makeCtx("json");
    const refreshStoredSession = mock(async () => ({
      kind: "not-signed-in" as const,
    }));

    const result = await handleSwitchWorkspace(ctx, {
      env: {},
      refreshStoredSession,
    });

    expect(result).toEqual({ error: "non-interactive" });
    // The session is never touched: there is nothing this run could do with it.
    expect(refreshStoredSession).not.toHaveBeenCalled();
  });

  it("reports a machine with no browser session", async () => {
    const ctx = makeCtx("human");

    const result = await handleSwitchWorkspace(ctx, {
      env: {},
      refreshStoredSession: async () => ({ kind: "not-signed-in" as const }),
    });

    expect(result).toEqual({ error: "not signed in" });
    expect(ctx.ui.error).toHaveBeenCalledWith(
      authMessages.workspace.notSignedIn,
    );
  });

  // Before this, a spent access token was presented as-is and the platform's
  // 401 was rendered as "API key is invalid or unauthorized" — blaming the
  // credential for a session that only needed renewing.
  it("names an expired session rather than blaming the credential", async () => {
    const ctx = makeCtx("human");

    const result = await handleSwitchWorkspace(ctx, {
      env: {},
      refreshStoredSession: async () => ({ kind: "refresh-failed" as const }),
    });

    expect(result).toEqual({ error: "session expired" });
    expect(ctx.ui.error).toHaveBeenCalledWith(
      authMessages.workspace.sessionExpired,
    );
  });

  it("renews the session before reaching the picker", async () => {
    const ctx = makeCtx("human");
    const refreshStoredSession = mock(async () => ({
      kind: "refresh-failed" as const,
    }));

    await handleSwitchWorkspace(ctx, { env: {}, refreshStoredSession });

    expect(refreshStoredSession).toHaveBeenCalledTimes(1);
    expect(refreshStoredSession).toHaveBeenCalledWith("/config", undefined);
  });
});
