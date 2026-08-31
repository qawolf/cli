import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerLaunch } from "./launch.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

const launched = {
  gpuAccelerated: false,
  id: "cli-minted",
  alreadyRunning: false as const,
  outcome: "success" as const,
  runnerName: "playwright" as const,
};

describe("handleRunnerLaunch", () => {
  it("launches under a minted id and stores it as the directory's default", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: launched });
    const deps = makeTestDeps();

    expect(
      await handleRunnerLaunch(ctx, { id: undefined, name: undefined }, deps),
    ).toBeUndefined();

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.launch,
      { id: "cli-minted" },
      runnerCallOptions,
    );
    expect(await deps.store.readDefaultRunnerId()).toBe("cli-minted");
  });

  it("launches under the id the caller chose, with the image they asked for", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { ...launched, id: "ci", runnerName: "android" },
    });

    await handleRunnerLaunch(
      ctx,
      { id: "ci", name: "android" },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.launch,
      { id: "ci", runnerName: "android" },
      runnerCallOptions,
    );
  });

  // The contract answers `already-running` rather than starting a second runner,
  // and the caller has to be able to tell which happened.
  it("says when the id was already running rather than newly launched", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        ...launched,
        id: "ci",
        alreadyRunning: true,
        outcome: "success",
      },
    });

    await handleRunnerLaunch(
      ctx,
      { id: "ci", name: undefined },
      makeTestDeps(),
    );

    expect(outputs()[0]?.humanMessage).toContain("already running");
  });

  it("refuses an id the published schema does not admit, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerLaunch(
      ctx,
      { id: "Not A Runner Id", name: undefined },
      makeTestDeps(),
    );

    expect(result?.error).toContain("lowercase letters");
    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses an image outside the published union, without a request", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerLaunch(
      ctx,
      { id: "ci", name: "node24WithPlaywright" },
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  // A launch is one attempt with a deadline, and a pod slower than the deadline
  // is created and billed anyway. Forgetting the id here is what would make the
  // retry mint a new one and pay for a second pod, so the id survives the
  // failure and the message says what to do with it.
  it("keeps the id and names it when the answer was lost", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "request timed out after 15000ms",
      mayHaveArrived: true,
      ok: false,
    });
    const deps = makeTestDeps();

    const result = await handleRunnerLaunch(
      ctx,
      { id: "ci", name: undefined },
      deps,
    );

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toContain("timed out");
    expect(result?.error).toContain("qawolf runner launch --id ci");
    expect(result?.errorBody).toBeUndefined();
    expect(await deps.store.readDefaultRunnerId()).toBe("ci");
  });

  // The server answering "no" means no pod exists under this id. Relaunching it
  // would fail the same way, and leaving it stored would send every later command
  // in this directory to a runner that was never started.
  it("forgets the id and gives no relaunch advice when the launch was refused", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "runner ci is already running basic",
      ok: false,
    });
    const deps = makeTestDeps();

    const result = await handleRunnerLaunch(
      ctx,
      { id: "ci", name: undefined },
      deps,
    );

    expect(result?.error).toContain("already running basic");
    expect(result?.error).not.toContain("relaunch");
    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });

  // The server's own reason is the only thing that names which image the id is
  // already running, so a refused launch has to pass it on rather than leave
  // the caller with a bare status code.
  it("passes on the reason the server gave for refusing the launch", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API runner.launch request failed (HTTP 409).",
      errorBody:
        "runner ci is already running basic; stop it before launching android",
      ok: false,
    });

    const result = await handleRunnerLaunch(
      ctx,
      { id: "ci", name: "android" },
      makeTestDeps(),
    );

    expect(result?.errorBody).toContain("already running basic");
    expect(result?.exitCode).toBe(4);
  });

  // The default the directory had before may name a runner that is still
  // running and billing, so a refused launch of a different id must not lose it.
  it("restores the previous default when the launch was refused", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "runner quota reached",
      ok: false,
    });
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("running-a");

    await handleRunnerLaunch(ctx, { id: "ci", name: undefined }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBe("running-a");
  });

  // The pod is what costs money, so a directory the CLI cannot write to must not
  // turn a launch that worked into a failure with an unnamed runner behind it.
  it("still reports the runner when the default cannot be written", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: launched });

    const result = await handleRunnerLaunch(
      ctx,
      { id: undefined, name: undefined },
      makeTestDeps({
        store: {
          forgetRunner: async () => {},
          readDefaultRunnerId: async () => undefined,
          readRunners: async () => [],
          rememberLaunch: async () => {
            throw new Error("EACCES: permission denied, mkdir '/app/.qawolf'");
          },
          retainRunners: async () => {},
          writeDefaultRunnerId: async () => {},
        },
      }),
    );

    expect(result).toBeUndefined();
    expect(outputs()[0]?.humanMessage).toContain("cli-minted");
    expect(ctx.ui.warn).toHaveBeenCalledWith(
      expect.stringContaining("--runner cli-minted"),
    );
  });
});
