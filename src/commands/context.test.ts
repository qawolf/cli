import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Command } from "commander";

import { withAuthContext, withContext } from "~/commands/context.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

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
    const okRequireApiKey = async () => ({
      key: "qawolf_test",
      source: "env" as const,
    });
    await withAuthContext(
      noopSignals,
      async () => {
        throw new Error("handler boom");
      },
      { requireApiKey: okRequireApiKey },
    )({}, fakeCommand());

    expect(process.exitCode).toBe(1);
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
