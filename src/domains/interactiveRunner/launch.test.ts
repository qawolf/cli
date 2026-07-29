import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { handleRunnerLaunch } from "./launch.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const launched = {
  gpuAccelerated: false,
  id: "cli-minted",
  outcome: "launched" as const,
  runnerName: "node20WithPlaywright" as const,
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
      {
        id: "cli-minted",
      },
    );
    expect(await deps.store.readDefaultRunnerId()).toBe("cli-minted");
  });

  it("launches under the id the caller chose, with the image they asked for", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { ...launched, id: "ci", runnerName: "node20WithAndroid" },
    });

    await handleRunnerLaunch(
      ctx,
      { id: "ci", name: "node20WithAndroid" },
      makeTestDeps(),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.launch,
      {
        id: "ci",
        runnerName: "node20WithAndroid",
      },
    );
  });

  // The contract answers `already-running` rather than starting a second runner,
  // and the caller has to be able to tell which happened.
  it("says when the id was already running rather than newly launched", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { ...launched, id: "ci", outcome: "already-running" },
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

  it("reports a failed request as a network failure and stores no default", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: false, error: "apex unreachable" });
    const deps = makeTestDeps();

    const result = await handleRunnerLaunch(
      ctx,
      { id: "ci", name: undefined },
      deps,
    );

    expect(result).toEqual({ error: "apex unreachable", exitCode: 4 });
    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });
});
