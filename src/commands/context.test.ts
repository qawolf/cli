import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";

import {
  buildBaseContext,
  withAuthContext,
  withContext,
} from "~/commands/context.js";
import { exitCodes } from "~/shell/exit.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeMockPlatformClient } from "~/shell/platform/createPlatformClient.testUtils.js";

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

  it("sets exitCode to exitCodes.auth (3) when requireApiKey throws", async () => {
    await withAuthContext(noopSignals, async () => undefined, {
      requireApiKey: failRequireApiKey,
    })({}, fakeCommand());

    expect(process.exitCode).toBe(exitCodes.auth);
  });

  it("sets exitCode to 1 when the action throws after auth succeeds", async () => {
    await withAuthContext(
      noopSignals,
      async () => {
        throw new Error("handler boom");
      },
      {
        requireApiKey: okRequireApiKey,
        createPlatform: () => makeMockPlatformClient(),
      },
    )({}, fakeCommand());

    expect(process.exitCode).toBe(1);
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
