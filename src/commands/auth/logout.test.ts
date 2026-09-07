import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/types.js";
import { handleLogout } from "./logout.js";

afterEach(() => {
  mock.restore();
});

type Task<T> = { message: string; task: () => T | Promise<T> };

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
      outro: mock(),
      output: mock(),
      // Run every task so the test observes the real deletion calls.
      withProgress: mock(
        async (tasks: Task<unknown>[], summarise?: unknown) => {
          const results = [];
          for (const t of tasks) results.push(await t.task());
          if (typeof summarise === "function") summarise(results);
          return results;
        },
      ),
      ...ui,
    } as unknown as UI,
    configDir: "/config",
  } as unknown as CommandContext & { ui: UI };
}

function makeDeps(args: {
  stored: boolean;
  env?: Record<string, string | undefined>;
}) {
  return {
    hasStoredCredentials: mock(async () => args.stored),
    deleteApiKey: mock(async () => ({
      keychain: "deleted" as const,
      file: "deleted" as const,
    })),
    deleteTokens: mock(async () => ({
      keychain: "deleted" as const,
      file: "deleted" as const,
    })),
    env: args.env ?? {},
  };
}

// A factory, not a shared constant: a module-level mock would carry its call
// record from one test into the next.
function confirmed() {
  return {
    mode: "human" as const,
    confirm: mock(async () => ({ ok: true as const, value: true })),
  };
}

describe("handleLogout", () => {
  it("clears browser tokens as well as the stored API key", async () => {
    const ctx = makeCtx(confirmed());
    const deps = makeDeps({ stored: true });

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(deps.deleteTokens).toHaveBeenCalledTimes(1);
  });

  // The bug this replaces: deletion used to sit behind resolveApiKey, which
  // refreshes a browser session over the network. Offline, or once WorkOS had
  // rotated the refresh token away, logout reported "not authenticated" and
  // left the credentials on disk.
  it("clears credentials that can no longer be resolved", async () => {
    const ctx = makeCtx(confirmed());
    const deps = makeDeps({ stored: true });

    await handleLogout(ctx, deps);

    expect(ctx.ui.info).not.toHaveBeenCalled();
    expect(deps.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(deps.deleteTokens).toHaveBeenCalledTimes(1);
  });

  it("does not consult the network to decide whether to delete", async () => {
    const ctx = makeCtx(confirmed());
    const deps = makeDeps({ stored: true });

    await handleLogout(ctx, deps);

    expect(deps.hasStoredCredentials).toHaveBeenCalledTimes(1);
    expect(deps.hasStoredCredentials).toHaveBeenCalledWith(
      "/config",
      undefined,
    );
  });

  it("deletes nothing when there is nothing stored", async () => {
    const ctx = makeCtx({ mode: "human" });
    const deps = makeDeps({ stored: false });

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).not.toHaveBeenCalled();
    expect(deps.deleteTokens).not.toHaveBeenCalled();
  });

  it("warns that an environment variable cannot be removed", async () => {
    const ctx = makeCtx(confirmed());
    const deps = makeDeps({
      stored: false,
      env: { QAWOLF_API_KEY: "qaw_env" },
    });

    await handleLogout(ctx, deps);

    expect(ctx.ui.warn).toHaveBeenCalled();
  });

  it("still clears storage when only an environment key is set", async () => {
    const ctx = makeCtx(confirmed());
    const deps = makeDeps({
      stored: false,
      env: { QAWOLF_API_KEY: "qaw_env" },
    });

    await handleLogout(ctx, deps);

    expect(deps.deleteTokens).toHaveBeenCalledTimes(1);
  });

  it("deletes nothing when the confirmation is declined", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: false })),
    });
    const deps = makeDeps({ stored: true });

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).not.toHaveBeenCalled();
    expect(deps.deleteTokens).not.toHaveBeenCalled();
  });
});
