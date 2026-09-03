import { afterEach, describe, expect, it, mock } from "bun:test";

import type { ApiKeyResult } from "~/domains/auth/types.js";
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

function makeDeps(existing: ApiKeyResult | undefined) {
  return {
    resolveApiKey: async () => existing,
    deleteApiKey: mock(async () => ({
      keychain: "deleted" as const,
      file: "deleted" as const,
    })),
    deleteTokens: mock(async () => ({
      keychain: "deleted" as const,
      file: "deleted" as const,
    })),
  };
}

describe("handleLogout", () => {
  it("clears browser tokens as well as the stored API key", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
    });
    const deps = makeDeps({
      key: "qaw_stored",
      source: "keychain",
    });

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).toHaveBeenCalledTimes(1);
    expect(deps.deleteTokens).toHaveBeenCalledTimes(1);
  });

  it("clears credentials for someone signed in through the browser", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
    });
    const deps = makeDeps({
      key: "access_abc",
      source: "browser",
    });

    await handleLogout(ctx, deps);

    expect(deps.deleteTokens).toHaveBeenCalledTimes(1);
  });

  it("deletes nothing when there is nothing stored", async () => {
    const ctx = makeCtx({ mode: "human" });
    const deps = makeDeps(undefined);

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).not.toHaveBeenCalled();
    expect(deps.deleteTokens).not.toHaveBeenCalled();
  });

  it("warns that an environment variable cannot be removed", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: true })),
    });
    const deps = makeDeps({
      key: "qaw_env",
      source: "env",
    });

    await handleLogout(ctx, deps);

    expect(ctx.ui.warn).toHaveBeenCalled();
  });

  it("deletes nothing when the confirmation is declined", async () => {
    const ctx = makeCtx({
      mode: "human",
      confirm: mock(async () => ({ ok: true as const, value: false })),
    });
    const deps = makeDeps({
      key: "qaw_stored",
      source: "keychain",
    });

    await handleLogout(ctx, deps);

    expect(deps.deleteApiKey).not.toHaveBeenCalled();
    expect(deps.deleteTokens).not.toHaveBeenCalled();
  });
});
