import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerPromoteSnapshot } from "./promoteSnapshot.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const paths = {
  baselinePath: "checkout-1.png",
  runner: "ci",
  screenshotPath: "checkout-1-actual.png",
};

describe("handleRunnerPromoteSnapshot", () => {
  it("promotes the screenshot and names both paths", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success" },
    });

    expect(
      await handleRunnerPromoteSnapshot(ctx, paths, makeTestDeps()),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.promoteSnapshot,
      {
        baselinePath: "checkout-1.png",
        id: "ci",
        screenshotPath: "checkout-1-actual.png",
      },
      runnerCallOptions,
    );
    const [output] = outputs();
    expect(output?.humanMessage).toContain("checkout-1-actual.png");
    expect(output?.humanMessage).toContain("checkout-1.png");
  });

  it("names the screenshot path when the run wrote nothing there", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "snapshot-not-found", outcome: "failure" },
    });

    const result = await handleRunnerPromoteSnapshot(
      ctx,
      paths,
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("checkout-1-actual.png");
    expect(result?.error).toContain("imageDiffArtifact");
  });

  it.each([
    ["runner-cannot-promote-snapshots", 2, "stores no screenshots"],
    ["runner-unreachable", 4, "could not be reached"],
  ])("reports %s", async (failureReason, exitCode, text) => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason, outcome: "failure" },
    });

    const result = await handleRunnerPromoteSnapshot(
      ctx,
      paths,
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCode);
    expect(result?.error).toContain(text);
  });

  it("reports a network failure without reaching an outcome", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ error: "boom", ok: false });

    const result = await handleRunnerPromoteSnapshot(
      ctx,
      paths,
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toBe("boom");
  });
});
