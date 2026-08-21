import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerTerminate } from "./terminate.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

describe("handleRunnerTerminate", () => {
  it("terminates the runner the flag names", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "success", wasRunning: true },
    });

    expect(
      await handleRunnerTerminate(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.terminate,
      { id: "ci" },
      runnerCallOptions,
    );
    expect(outputs()[0]?.humanMessage).toContain("Terminated runner ci");
  });

  // A retried terminate should read as plainly as the first, which is why the
  // contract answers rather than raises.
  it("reports a runner that was not running without failing", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "success", wasRunning: false },
    });

    expect(
      await handleRunnerTerminate(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("was not running");
  });

  // Launching a runner in order to terminate it would bill one for nothing.
  it("never launches a runner, and says what to do instead", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerTerminate(
      ctx,
      { runner: undefined },
      makeTestDeps(),
    );

    expect(result?.error).toContain("--runner");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("terminates the stored default, and stops sending later commands to it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "success", wasRunning: true },
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    await handleRunnerTerminate(ctx, { runner: undefined }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });

  it("leaves the stored default alone when it terminated a different runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "other", outcome: "success", wasRunning: true },
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    await handleRunnerTerminate(ctx, { runner: "other" }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBe("ci");
  });

  // The pod is what costs money, and by this point it is already gone. A
  // directory the CLI cannot write to must not turn that into a failed command.
  it("still reports the terminate when the stored default cannot be cleared", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "success", wasRunning: true },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerTerminate(
      ctx,
      { runner: "ci" },
      {
        ...deps,
        store: {
          ...deps.store,
          readDefaultRunnerId: () => Promise.reject(Error("EROFS")),
        },
      },
    );

    expect(result).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("Terminated runner ci");
    expect(ctx.ui.warn).toHaveBeenCalled();
  });
});
