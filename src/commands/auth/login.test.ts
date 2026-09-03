import { afterEach, describe, expect, it, mock } from "bun:test";

import type { ApiKeyResult } from "~/domains/auth/types.js";
import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/types.js";
import { handleLogin } from "./login.js";

afterEach(() => {
  mock.restore();
});

function makeCtx(
  ui: Partial<UI> & { mode: UI["mode"] },
): CommandContext & { ui: UI } {
  return {
    ui: {
      gap: mock(),
      intro: mock(),
      info: mock(),
      warn: mock(),
      cancel: mock(),
      error: mock(),
      ...ui,
    } as unknown as UI,
    configDir: "/config",
  } as unknown as CommandContext & { ui: UI };
}

function makeDeps(
  overrides: {
    resolveApiKey?: () => Promise<ApiKeyResult | undefined>;
  } = {},
) {
  return {
    resolveApiKey: overrides.resolveApiKey ?? (async () => undefined),
    loginWithApiKey: mock(async () => undefined),
    loginWithDevice: mock(async () => undefined),
  };
}

describe("handleLogin", () => {
  it("refuses to run without an interactive terminal", async () => {
    const ctx = makeCtx({ mode: "json" });
    const deps = makeDeps();

    const result = await handleLogin(ctx, deps);

    expect(result).toEqual({ error: "non-interactive" });
    expect(deps.loginWithDevice).not.toHaveBeenCalled();
    expect(deps.loginWithApiKey).not.toHaveBeenCalled();
  });

  it("routes to browser sign-in when the browser option is chosen", async () => {
    const ctx = makeCtx({
      mode: "human",
      select: mock(async () => ({ ok: true as const, value: "browser" })),
    });
    const deps = makeDeps();

    await handleLogin(ctx, deps);

    expect(deps.loginWithDevice).toHaveBeenCalledTimes(1);
    expect(deps.loginWithApiKey).not.toHaveBeenCalled();
  });

  it("routes to the API key prompt when that option is chosen", async () => {
    const ctx = makeCtx({
      mode: "human",
      select: mock(async () => ({ ok: true as const, value: "api-key" })),
    });
    const deps = makeDeps();

    await handleLogin(ctx, deps);

    expect(deps.loginWithApiKey).toHaveBeenCalledTimes(1);
    expect(deps.loginWithDevice).not.toHaveBeenCalled();
  });

  it("signs in with neither method when the choice is dismissed", async () => {
    const ctx = makeCtx({
      mode: "human",
      select: mock(async () => ({ ok: false as const })),
    });
    const deps = makeDeps();

    await handleLogin(ctx, deps);

    expect(ctx.ui.cancel).toHaveBeenCalled();
    expect(deps.loginWithApiKey).not.toHaveBeenCalled();
    expect(deps.loginWithDevice).not.toHaveBeenCalled();
  });

  it("stops when an already-authenticated person declines to sign in again", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: false })),
      select: mock(async () => ({ ok: true as const, value: "browser" })),
    });
    const deps = makeDeps({
      resolveApiKey: async () => ({
        key: "qaw_existing",
        source: "env",
        workspaceId: undefined,
      }),
    });

    await handleLogin(ctx, deps);

    expect(deps.loginWithDevice).not.toHaveBeenCalled();
    expect(ctx.ui.select).not.toHaveBeenCalled();
  });

  it("offers the choice when an already-authenticated person confirms", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
      select: mock(async () => ({ ok: true as const, value: "browser" })),
    });
    const deps = makeDeps({
      resolveApiKey: async () => ({
        key: "qaw_existing",
        source: "env",
        workspaceId: undefined,
      }),
    });

    await handleLogin(ctx, deps);

    expect(deps.loginWithDevice).toHaveBeenCalledTimes(1);
  });
  // The precedence itself is deliberate; being told "Signed in as ..." while
  // every later command keeps using the old key is not.
  it.each([
    ["env" as const, "unset the variable"],
    ["keychain" as const, "auth logout"],
    ["file" as const, "auth logout"],
  ])(
    "warns before browser sign-in that a %s API key still wins",
    async (source, remedy) => {
      const ctx = makeCtx({
        mode: "human",
        confirm: mock(async () => ({ ok: true as const, value: true })),
        select: mock(async () => ({ ok: true as const, value: "browser" })),
      });
      const deps = makeDeps({
        resolveApiKey: async () => ({
          key: "qaw_old",
          source,
          workspaceId: undefined,
        }),
      });

      await handleLogin(ctx, deps);

      expect(ctx.ui.warn).toHaveBeenCalledTimes(1);
      expect(
        (ctx.ui.warn as ReturnType<typeof mock>).mock.calls[0]?.[0],
      ).toContain(remedy);
      expect(deps.loginWithDevice).toHaveBeenCalledTimes(1);
    },
  );

  it("does not warn when the previous session was itself a browser one", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
      select: mock(async () => ({ ok: true as const, value: "browser" })),
    });
    const deps = makeDeps({
      resolveApiKey: async () => ({
        key: "access_old",
        source: "browser",
        workspaceId: undefined,
      }),
    });

    await handleLogin(ctx, deps);

    expect(ctx.ui.warn).not.toHaveBeenCalled();
  });

  it("does not warn on the API key path, where nothing is shadowed", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
      select: mock(async () => ({ ok: true as const, value: "api-key" })),
    });
    const deps = makeDeps({
      resolveApiKey: async () => ({
        key: "qaw_old",
        source: "keychain",
        workspaceId: undefined,
      }),
    });

    await handleLogin(ctx, deps);

    expect(ctx.ui.warn).not.toHaveBeenCalled();
    expect(deps.loginWithApiKey).toHaveBeenCalledTimes(1);
  });
});
