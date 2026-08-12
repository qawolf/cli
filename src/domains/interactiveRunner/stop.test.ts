import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerStop } from "./stop.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

describe("handleRunnerStop", () => {
  it("stops the runner the flag names", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "stopped" },
    });

    expect(
      await handleRunnerStop(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(publicContractsV1.runner.stop, {
      id: "ci",
    });
    expect(outputs()[0]?.humanMessage).toContain("Stopped runner ci");
  });

  // A retried stop should read as plainly as the first, which is why the
  // contract answers rather than raises.
  it("reports a runner that was not running without failing", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "not-running" },
    });

    expect(
      await handleRunnerStop(ctx, { runner: "ci" }, makeTestDeps()),
    ).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("was not running");
  });

  // Launching a runner in order to stop it would bill one for nothing.
  it("never launches a runner, and says what to do instead", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerStop(
      ctx,
      { runner: undefined },
      makeTestDeps(),
    );

    expect(result?.error).toContain("--runner");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("stops the stored default, and stops sending later commands to it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "stopped" },
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    await handleRunnerStop(ctx, { runner: undefined }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });

  it("leaves the stored default alone when it stopped a different runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "other", outcome: "stopped" },
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("ci");

    await handleRunnerStop(ctx, { runner: "other" }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBe("ci");
  });

  // The pod is what costs money, and by this point it is already stopped. A
  // directory the CLI cannot write to must not turn that into a failed command.
  it("still reports the stop when the stored default cannot be cleared", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { id: "ci", outcome: "stopped" },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerStop(
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
    expect(outputs()[0]?.humanMessage).toContain("Stopped runner ci");
    expect(ctx.ui.warn).toHaveBeenCalled();
  });
});
