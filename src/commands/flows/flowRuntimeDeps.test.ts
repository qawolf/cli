import { describe, expect, it, mock } from "bun:test";
import type { EmailsClient } from "@qawolf/emails";

import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { createFlowRuntimeDeps } from "./flowRuntimeDeps.js";

function makeCtx() {
  return {
    apiBaseUrl: "https://app.qawolf.com",
    configDir: "/config",
    fs: makeMemoryFs(),
    log: () => makeNoopLogger(),
  };
}

describe("createFlowRuntimeDeps", () => {
  it("uses explicit EMAILER_URL lazily without resolving API credentials", async () => {
    const getInbox = mock(
      async () => undefined,
    ) as unknown as EmailsClient["getInbox"];
    const client = { getInbox } as unknown as EmailsClient;
    const resolveApiKeyFn = mock(async () => {
      throw new Error("should not resolve api key");
    });
    const configureEmailsFn = mock(async () => client);

    const deps = await createFlowRuntimeDeps({
      envDir: "/env",
      ctx: makeCtx(),
      env: {
        EMAILER_URL: "https://emailer.example",
        CLOUD_AGENTS_INBOX_TEAM_ID: "team_123",
      },
      resolveApiKeyFn,
      configureEmailsFn,
    });

    expect(resolveApiKeyFn).not.toHaveBeenCalled();
    expect(configureEmailsFn).not.toHaveBeenCalled();

    await (deps.getInbox as (...args: unknown[]) => Promise<unknown>)({
      address: "test@example.com",
    });

    expect(resolveApiKeyFn).not.toHaveBeenCalled();
    expect(configureEmailsFn).toHaveBeenCalledWith(
      { emailerUrl: "https://emailer.example", teamId: "team_123" },
      "/env",
    );
  });

  it("returns env-var deps immediately and delays missing-auth failure until getInbox", async () => {
    const configureEmailsFn = mock(
      async () =>
        ({ getInbox: async () => undefined }) as unknown as EmailsClient,
    );

    const deps = await createFlowRuntimeDeps({
      envDir: "/env",
      ctx: makeCtx(),
      env: {},
      resolveApiKeyFn: async () => undefined,
      configureEmailsFn,
    });

    expect(configureEmailsFn).not.toHaveBeenCalled();
    expect(deps.getInbox).toBeFunction();
    expect(deps.setEnvironmentVariable).toBeFunction();
    expect(deps.fetchLatestEnvironmentVariables).toBeFunction();

    let caught: unknown;
    try {
      await (deps.getInbox as (...args: unknown[]) => Promise<unknown>)({
        address: "test@example.com",
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toMatch(/getInbox requires EMAILER_URL/);
    expect(configureEmailsFn).not.toHaveBeenCalled();
  });
});
