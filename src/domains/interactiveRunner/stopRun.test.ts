import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";
import { handleRunnerStopRun } from "./stopRun.js";

describe("handleRunnerStopRun", () => {
  it("stops the run on the runner the flag names", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", wasRunning: true },
    });

    expect(
      await handleRunnerStopRun(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.stopRun,
      { id: "ci" },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toContain(
      "Stopped the run on runner ci",
    );
  });

  it("reports a runner with nothing to stop without failing", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", wasRunning: false },
    });

    expect(
      await handleRunnerStopRun(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("had nothing to stop");
  });

  it("never launches a runner, and says what to do instead", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerStopRun(
      ctx,
      { runner: undefined },
      makeTestDeps(),
    );

    expect(result?.error).toContain("--runner");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("reads an unreachable runner as worth retrying", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerStopRun(
      ctx,
      { runner: "ci" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("Retry");
    expect(result?.exitCode).toBe(4);
  });

  it("leaves the directory's stored runner alone", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { outcome: "success", wasRunning: true },
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    await handleRunnerStopRun(ctx, { runner: undefined }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBe("ci");
  });
});
