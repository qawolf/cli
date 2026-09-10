import { describe, expect, it } from "bun:test";

import { callsOf } from "~/shell/commandContext.testUtils.js";

import { handleRunnerList } from "./list.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { everywhere, listed, runner, watchUrl } from "./list.testUtils.js";

describe("handleRunnerList", () => {
  it("says so when the team has no runner running", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi.mockResolvedValue(listed());

    const result = await handleRunnerList(ctx, everywhere, makeTestDeps());

    expect(result).toBeUndefined();
    expect(infos()[0]).toContain("no runner running");
  });

  it("names every runner the team runs, wherever it was launched", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("agent");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(
      listed(runner("ci"), runner("review", "android")),
    );

    await handleRunnerList(ctx, everywhere, deps);

    const written = callsOf(ctx.ui.write)
      .map((call) => String(call[0]))
      .join("");
    expect(written).toContain("ci");
    expect(written).toContain("review");
    expect(written).toContain("android");
    expect(written).toContain("launched here");
    expect(written).not.toContain(watchUrl("ci"));
  });

  it("marks the runners this directory launched", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(
      listed(runner("elsewhere", "android"), runner("ci")),
    );

    await handleRunnerList(ctx, everywhere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "ci",
        isDefault: true,
        launchedHere: true,
        runnerName: "playwright",
        url: watchUrl("ci"),
      },
      {
        id: "elsewhere",
        isDefault: false,
        launchedHere: false,
        runnerName: "android",
        url: watchUrl("elsewhere"),
      },
    ]);
  });

  it("orders the default first, then this directory's, then the rest by id", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "mine-b" });
    await deps.store.rememberLaunch({ id: "mine-a" });
    await deps.store.rememberLaunch({ id: "chosen" });
    callPublicApi.mockResolvedValue(
      listed(
        runner("theirs-b"),
        runner("mine-b"),
        runner("chosen"),
        runner("theirs-a"),
        runner("mine-a"),
      ),
    );

    await handleRunnerList(ctx, everywhere, deps);

    const ids = callsOf(ctx.ui.json).map((call) =>
      (call[0] as { id: string }[]).map((item) => item.id),
    );
    expect(ids).toEqual([
      ["chosen", "mine-a", "mine-b", "theirs-a", "theirs-b"],
    ]);
  });

  it("forgets a held runner the platform no longer has", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "idled-out" });
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(listed(runner("ci")));

    await handleRunnerList(ctx, everywhere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "ci",
        isDefault: true,
        launchedHere: true,
        runnerName: "playwright",
        url: watchUrl("ci"),
      },
    ]);
    expect((await deps.store.readRunners()).map((held) => held.id)).toEqual([
      "ci",
    ]);
  });

  // Listing is a read, so it reports that the default is gone without
  // retargeting the commands that would have gone to it. Those still fail with
  // "runner unreachable" rather than quietly billing a fresh pod.
  it("marks no default when the default runner has terminated", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    await deps.store.rememberLaunch({ id: "idled-out" });
    callPublicApi.mockResolvedValue(listed(runner("ci")));

    await handleRunnerList(ctx, everywhere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "ci",
        isDefault: false,
        launchedHere: true,
        runnerName: "playwright",
        url: watchUrl("ci"),
      },
    ]);
    expect(await deps.store.readDefaultRunnerId()).toBe("idled-out");
  });

  it("marks the environment's runner as the default over the stored one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "from-env" } });
    await deps.store.rememberLaunch({ id: "stored", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(
      listed(runner("stored"), runner("from-env", "basic")),
    );

    await handleRunnerList(ctx, everywhere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "from-env",
        isDefault: true,
        launchedHere: false,
        runnerName: "basic",
        url: watchUrl("from-env"),
      },
      {
        id: "stored",
        isDefault: false,
        launchedHere: true,
        runnerName: "playwright",
        url: watchUrl("stored"),
      },
    ]);
  });

  it("lists the family the platform reports, not the one remembered locally", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci" });
    callPublicApi.mockResolvedValue(listed(runner("ci", "android")));

    await handleRunnerList(ctx, everywhere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "ci",
        isDefault: true,
        launchedHere: true,
        runnerName: "android",
        url: watchUrl("ci"),
      },
    ]);
  });

  it("reports a listing that failed", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci" });
    callPublicApi.mockResolvedValue({
      error: "network unreachable",
      ok: false,
    });

    const result = await handleRunnerList(ctx, everywhere, deps);

    expect(result?.error).toContain("network unreachable");
    expect(ctx.ui.json).not.toHaveBeenCalled();
    expect((await deps.store.readRunners()).map((held) => held.id)).toEqual([
      "ci",
    ]);
  });

  it("only reads, and never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(listed());

    await handleRunnerList(ctx, everywhere, makeTestDeps());

    const contracts = callsOf(callPublicApi).map(
      (call) => (call[0] as { kind: string; name: string }).name,
    );
    expect(contracts).toEqual(["runner.list"]);
  });
});
