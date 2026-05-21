import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import {
  buildBaseContext,
  withAuthContext,
  withContext,
} from "~/commands/context.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { PlatformClient } from "~/shell/platform/createPlatformClient.js";

const noopSignals = makeNoopSignals();

function fakeCommand(): Command {
  return {
    optsWithGlobals: () => ({}),
  } as unknown as Command;
}

// `process.exitCode` is global state and persists across tests; reset to 0
// before/after each case so a single test setting it does not bleed into
// other test files (bun's runner reads exitCode at process exit).
beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  process.exitCode = 0;
  mock.restore();
});

function makeTeam() {
  return {
    id: "t1",
    name: "Test Team",
    slug: "test-team",
    createdAt: "2024-01-01T00:00:00.000Z",
  };
}

function mockPlatform(
  identityResult: Awaited<ReturnType<PlatformClient["getIdentity"]>>,
): PlatformClient {
  return {
    getIdentity: async () => identityResult,
    getFlowsBundleUrl: async (_envId: string) => ({
      ok: false as const,
      error: "not used",
    }),
    getEnvVars: async (_envId: string) => ({
      ok: false as const,
      error: "not used",
    }),
    downloadBundle: async (_envId: string) => ({
      ok: false as const,
      error: "not used",
    }),
  };
}

const okRequireApiKey = async () => ({
  key: "qawolf_test",
  source: "env" as const,
});

describe("withAuthContext exit code plumbing", () => {
  const failRequireApiKey = async (): Promise<never> => {
    throw new Error(
      "QAWOLF_API_KEY is not set. Set it in your environment, or run 'qawolf auth login'.",
    );
  };

  it("sets exitCode to 1 when requireApiKey throws", async () => {
    await withAuthContext(noopSignals, async () => undefined, {
      requireApiKey: failRequireApiKey,
    })({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });

  it("sets exitCode to 1 when the action throws after auth succeeds", async () => {
    await withAuthContext(
      noopSignals,
      async () => {
        throw new Error("handler boom");
      },
      {
        requireApiKey: okRequireApiKey,
        createPlatform: () =>
          mockPlatform({ ok: true, value: { team: makeTeam() } }),
      },
    )({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });

  it("sets exitCode to 1 when getIdentity returns an error", async () => {
    await withAuthContext(noopSignals, async () => undefined, {
      requireApiKey: okRequireApiKey,
      createPlatform: () =>
        mockPlatform({
          ok: false,
          error: "API key is invalid or unauthorized",
        }),
    })({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });

  it("does not call action when getIdentity fails", async () => {
    const action = mock();
    await withAuthContext(noopSignals, action, {
      requireApiKey: okRequireApiKey,
      createPlatform: () =>
        mockPlatform({
          ok: false,
          error: "API key is invalid or unauthorized",
        }),
    })({}, fakeCommand());

    expect(action).not.toHaveBeenCalled();
  });

  it("injects team into context when getIdentity succeeds", async () => {
    const team = makeTeam();
    let capturedTeam: unknown;
    await withAuthContext(
      noopSignals,
      async (ctx) => {
        capturedTeam = ctx.team;
      },
      {
        requireApiKey: okRequireApiKey,
        createPlatform: () => mockPlatform({ ok: true, value: { team } }),
      },
    )({}, fakeCommand());

    expect(capturedTeam).toEqual(team);
  });
});

describe("buildBaseContext", () => {
  it("should include log factory in CommandContext", () => {
    const cmd = new Command();
    cmd
      .option("--verbose", "Enable debug logging to stderr")
      .option("--json", "Output as JSON")
      .option("--agent", "Output for agent consumption");
    cmd.parse([], { from: "user" });

    const { ctx } = buildBaseContext(cmd, noopSignals);

    const scopedLogger = ctx.log("test");
    expect(typeof scopedLogger.error).toBe("function");
    expect(typeof scopedLogger.warn).toBe("function");
    expect(typeof scopedLogger.info).toBe("function");
    expect(typeof scopedLogger.debug).toBe("function");
    expect(typeof scopedLogger.trace).toBe("function");
  });
});

describe("withContext exit code plumbing", () => {
  it("leaves exitCode at 0 when the action returns undefined", async () => {
    await withContext(noopSignals, async () => undefined)({}, fakeCommand());

    expect(process.exitCode).toBe(0);
  });

  it("sets exitCode to 1 when the action returns { error } without exitCode", async () => {
    await withContext(noopSignals, async () => ({ error: "boom" }))(
      {},
      fakeCommand(),
    );

    expect(process.exitCode).toBe(1);
  });

  it("uses result.exitCode when provided (e.g. 2 for invalid-args)", async () => {
    await withContext(noopSignals, async () => ({
      error: "bad flag",
      exitCode: 2,
    }))({}, fakeCommand());

    expect(process.exitCode).toBe(2);
  });

  it("sets exitCode to 1 when the action throws", async () => {
    await withContext(noopSignals, async () => {
      throw new Error("boom");
    })({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });
});
