import { describe, expect, it, mock } from "bun:test";

import { pulledEnvFallback } from "./withResolvedEnv.js";

describe("pulledEnvFallback", () => {
  it("consults the fallback when the platform never answered", async () => {
    const offlineFallback = mock(() => Promise.resolve("env-abc"));

    const pulled = await pulledEnvFallback(
      { unreachable: true },
      "staging",
      offlineFallback,
    );

    expect(pulled).toBe("env-abc");
    expect(offlineFallback).toHaveBeenCalledWith("staging");
  });

  // A 404 or a revoked key is the platform answering no. Running a stale
  // pulled copy behind a "could not reach the platform" warning would be a
  // false statement and the wrong action.
  it("never consults the fallback when the platform answered", async () => {
    const offlineFallback = mock(() => Promise.resolve("env-abc"));

    const pulled = await pulledEnvFallback(
      { unreachable: false },
      "staging",
      offlineFallback,
    );

    expect(pulled).toBeUndefined();
    expect(offlineFallback).not.toHaveBeenCalled();
  });

  it("surfaces the error when nothing is pulled", async () => {
    const pulled = await pulledEnvFallback(
      { unreachable: true },
      "staging",
      () => Promise.resolve(undefined),
    );

    expect(pulled).toBeUndefined();
  });

  it("is undefined when the command has no fallback", async () => {
    const pulled = await pulledEnvFallback(
      { unreachable: true },
      "staging",
      undefined,
    );

    expect(pulled).toBeUndefined();
  });
});
