import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Command } from "commander";

import { withContext } from "./context.js";

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

describe("withContext exit code plumbing", () => {
  it("leaves exitCode at 0 when the action returns undefined", async () => {
    await withContext(async () => undefined)({}, fakeCommand());

    expect(process.exitCode).toBe(0);
  });

  it("sets exitCode to 1 when the action returns { error } without exitCode", async () => {
    await withContext(async () => ({ error: "boom" }))({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });

  it("uses result.exitCode when provided (e.g. 2 for invalid-args)", async () => {
    await withContext(async () => ({ error: "bad flag", exitCode: 2 }))(
      {},
      fakeCommand(),
    );

    expect(process.exitCode).toBe(2);
  });

  it("sets exitCode to 1 when the action throws", async () => {
    await withContext(async () => {
      throw new Error("boom");
    })({}, fakeCommand());

    expect(process.exitCode).toBe(1);
  });
});
