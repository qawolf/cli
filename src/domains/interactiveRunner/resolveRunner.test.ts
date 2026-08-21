import { describe, expect, it } from "bun:test";

import { interactiveRunnerMessages } from "~/core/messages/index.js";

import { resolveRunner } from "./resolveRunner.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { runnerCallOptions } from "./runnerCallOptions.js";
import { compatLaunchContract } from "./runnerNameCompat.js";

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
      compatLaunchContract,
      { id: "cli-minted" },
      runnerCallOptions,
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

    expect(resolved).toEqual({
      error: interactiveRunnerMessages.noRunnerId,
      exitCode: 2,
      type: "failed",
    });
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("uses a command's own wording when it supplies one", async () => {
    const { ctx } = makeAuthCtx();

    const resolved = await resolveRunner(
      ctx,
      {
        autoLaunch: false,
        noRunnerIdMessage: "Launch one and open a page first.",
        runner: undefined,
      },
      makeTestDeps(),
    );

    expect(resolved).toEqual({
      error: "Launch one and open a page first.",
      exitCode: 2,
      type: "failed",
    });
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

  // The id is written before the request, not after: a launch that times out may
  // still have created and billed a pod, and an id kept only on success would be
  // lost exactly then, so the retry would mint a new one and pay twice.
  it("remembers the minted id before it launches, so a lost answer cannot lose it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "request timed out after 15000ms",
      mayHaveArrived: true,
      ok: false,
    });
    const deps = makeTestDeps();

    const resolved = await resolveRunner(
      ctx,
      { autoLaunch: true, runner: undefined },
      deps,
    );

    expect(resolved).toMatchObject({ exitCode: 4, type: "failed" });
    expect(await deps.store.readDefaultRunnerId()).toBe("cli-minted");
  });

  // A refusal is the server saying no pod exists under this id, so leaving it as
  // the directory's default would point every later command at a runner that was
  // never started.
  it("forgets the minted id when the launch was refused", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "already running a different image",
      ok: false,
    });
    const deps = makeTestDeps();

    await resolveRunner(ctx, { autoLaunch: true, runner: undefined }, deps);

    expect(await deps.store.readDefaultRunnerId()).toBeUndefined();
  });

  // The server's own reason is the only thing that names which image the id is
  // already running, so a refused auto-launch has to pass it on rather than
  // leave the caller with a bare status code.
  it("passes on the reason the server gave for refusing the launch", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "QA Wolf API runner.launch request failed (HTTP 409).",
      errorBody:
        "runner cli-minted is already running node20Basic; stop it before launching node20WithAndroid",
      ok: false,
    });

    const resolved = await resolveRunner(
      ctx,
      { autoLaunch: true, runner: undefined },
      makeTestDeps(),
    );

    expect(
      resolved.type === "failed" ? resolved.errorBody : undefined,
    ).toContain("already running node20Basic");
    expect(resolved).toMatchObject({ exitCode: 4, type: "failed" });
  });

  it("names the runner it was launching when the launch fails", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({ ok: false, error: "apex unreachable" });

    const resolved = await resolveRunner(
      ctx,
      { autoLaunch: true, runner: undefined },
      makeTestDeps(),
    );

    expect(resolved.type === "failed" && resolved.error).toContain(
      "cli-minted",
    );
  });
});
