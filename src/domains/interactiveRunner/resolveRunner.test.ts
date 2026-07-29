import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { resolveRunner } from "./resolveRunner.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

const launched = {
  gpuAccelerated: false,
  id: "cli-minted",
  outcome: "launched" as const,
  runnerName: "node20WithPlaywright" as const,
};

describe("resolveRunner", () => {
  it("takes the flag over everything else", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "from-env" } });
    await deps.store.writeDefaultRunnerId("from-store");

    expect(
      await resolveRunner(ctx, { autoLaunch: true, runner: "from-flag" }, deps),
    ).toEqual({ runnerId: "from-flag", type: "resolved" });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("takes the environment over the stored default", async () => {
    const { ctx } = makeAuthCtx();
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "from-env" } });
    await deps.store.writeDefaultRunnerId("from-store");

    expect(
      await resolveRunner(ctx, { autoLaunch: true, runner: undefined }, deps),
    ).toEqual({ runnerId: "from-env", type: "resolved" });
  });

  it("falls back to the stored default", async () => {
    const { ctx } = makeAuthCtx();
    const deps = makeTestDeps();
    await deps.store.writeDefaultRunnerId("from-store");

    expect(
      await resolveRunner(ctx, { autoLaunch: true, runner: undefined }, deps),
    ).toEqual({ runnerId: "from-store", type: "resolved" });
  });

  it("ignores a blank environment variable", async () => {
    const { ctx } = makeAuthCtx();
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "  " } });
    await deps.store.writeDefaultRunnerId("from-store");

    expect(
      await resolveRunner(ctx, { autoLaunch: true, runner: undefined }, deps),
    ).toEqual({ runnerId: "from-store", type: "resolved" });
  });

  // The caller has to be able to tell a fresh browser from one it already set
  // up, so a launch is reported as a launch rather than as a resolution.
  it("launches one when nothing names a runner, and says it launched", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: true, value: launched });
    const deps = makeTestDeps();

    expect(
      await resolveRunner(ctx, { autoLaunch: true, runner: undefined }, deps),
    ).toEqual({ runnerId: "cli-minted", type: "launched" });

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.launch,
      {
        id: "cli-minted",
      },
    );
    expect(await deps.store.readDefaultRunnerId()).toBe("cli-minted");
  });

  it("refuses rather than launching when the caller asked it not to", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const resolved = await resolveRunner(
      ctx,
      { autoLaunch: false, runner: undefined },
      makeTestDeps(),
    );

    expect(resolved.type).toBe("failed");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses an id the published schema does not admit", async () => {
    const { ctx } = makeAuthCtx();

    const resolved = await resolveRunner(
      ctx,
      { autoLaunch: true, runner: "Bad Id" },
      makeTestDeps(),
    );

    expect(resolved.type).toBe("failed");
  });

  it("passes on a launch failure rather than carrying on without a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: false, error: "apex unreachable" });

    expect(
      await resolveRunner(
        ctx,
        { autoLaunch: true, runner: undefined },
        makeTestDeps(),
      ),
    ).toEqual({ error: "apex unreachable", exitCode: 4, type: "failed" });
  });
});
