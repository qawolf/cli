import { describe, expect, it } from "bun:test";

import { callsOf } from "~/shell/commandContext.testUtils.js";

import { handleRunnerList } from "./list.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

type ListedRunner = { gpuAccelerated: boolean; id: string; runnerName: string };

function runner(id: string, runnerName = "playwright"): ListedRunner {
  return { gpuAccelerated: false, id, runnerName };
}

function listed(...runners: ListedRunner[]): { ok: true; value: unknown } {
  return { ok: true, value: { outcome: "success", runners } };
}

describe("handleRunnerList", () => {
  it("says so when the team has no runner running", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi.mockResolvedValue(listed());

    const result = await handleRunnerList(ctx, makeTestDeps());

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

    await handleRunnerList(ctx, deps);

    const written = callsOf(ctx.ui.write)
      .map((call) => String(call[0]))
      .join("");
    expect(written).toContain("ci");
    expect(written).toContain("review");
    expect(written).toContain("android");
  });

  it("forgets a held runner the platform no longer has", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "idled-out" });
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(listed(runner("ci")));

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "ci", isDefault: true, runnerName: "playwright" },
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

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "ci", isDefault: false, runnerName: "playwright" },
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

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "from-env", isDefault: true, runnerName: "basic" },
      { id: "stored", isDefault: false, runnerName: "playwright" },
    ]);
  });

  it("lists the family the platform reports, not the one remembered locally", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci" });
    callPublicApi.mockResolvedValue(listed(runner("ci", "android")));

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "ci", isDefault: true, runnerName: "android" },
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

    const result = await handleRunnerList(ctx, deps);

    expect(result?.error).toContain("network unreachable");
    expect(ctx.ui.json).not.toHaveBeenCalled();
    expect((await deps.store.readRunners()).map((held) => held.id)).toEqual([
      "ci",
    ]);
  });

  it("only reads, and never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue(listed());

    await handleRunnerList(ctx, makeTestDeps());

    const contracts = callsOf(callPublicApi).map(
      (call) => (call[0] as { kind: string; name: string }).name,
    );
    expect(contracts).toEqual(["runner.list"]);
  });
});
