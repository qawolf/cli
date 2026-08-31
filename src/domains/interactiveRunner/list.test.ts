import { describe, expect, it } from "bun:test";

import { callsOf } from "~/domains/runner/run.fixtures.js";

import { handleRunnerList } from "./list.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

function running(id: string): { ok: true; value: unknown } {
  return { ok: true, value: { id, outcome: "success", running: true } };
}

function gone(id: string): { ok: true; value: unknown } {
  return { ok: true, value: { id, outcome: "success", running: false } };
}

describe("handleRunnerList", () => {
  it("says so when the directory holds no runner", async () => {
    const { ctx, infos } = makeAuthCtx();

    const result = await handleRunnerList(ctx, makeTestDeps());

    expect(result).toBeUndefined();
    expect(infos()[0]).toContain("no runner running");
  });

  it("names every runner the directory launched", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("agent");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    await deps.store.rememberLaunch({ id: "review", runnerName: "android" });
    callPublicApi.mockImplementation(async (_contract, input) =>
      running(String((input as { id: string }).id)),
    );

    await handleRunnerList(ctx, deps);

    const written = callsOf(ctx.ui.write)
      .map((call) => String(call[0]))
      .join("");
    expect(written).toContain("ci");
    expect(written).toContain("review");
    expect(written).toContain("android");
  });

  it("leaves out a runner that has terminated, and forgets it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "idled-out" });
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockImplementation(async (_contract, input) => {
      const { id } = input as { id: string };
      return id === "ci" ? running(id) : gone(id);
    });

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "ci", isDefault: true, runnerName: "playwright" },
    ]);
    expect((await deps.store.readRunners()).map((runner) => runner.id)).toEqual(
      ["ci"],
    );
  });

  // Listing is a read, so it reports that the default is gone without
  // retargeting the commands that would have gone to it. Those still fail with
  // "runner unreachable" rather than quietly billing a fresh pod.
  it("marks no default when the default runner has terminated", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    await deps.store.rememberLaunch({ id: "idled-out" });
    callPublicApi.mockImplementation(async (_contract, input) => {
      const { id } = input as { id: string };
      return id === "ci" ? running(id) : gone(id);
    });

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "ci", isDefault: false, runnerName: "playwright" },
    ]);
    expect(await deps.store.readDefaultRunnerId()).toBe("idled-out");
  });

  // The session's first runner is launched for the CLI rather than by it, so
  // nothing but the environment names it.
  it("includes the runner named by the environment", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "tester-abc" } });
    callPublicApi.mockImplementation(async (_contract, input) =>
      running(String((input as { id: string }).id)),
    );

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "tester-abc", isDefault: true, runnerName: undefined },
    ]);
  });

  it("marks the environment's runner as the default over the stored one", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps({ env: { QAWOLF_RUNNER_ID: "from-env" } });
    await deps.store.rememberLaunch({ id: "stored", runnerName: "playwright" });
    callPublicApi.mockImplementation(async (_contract, input) =>
      running(String((input as { id: string }).id)),
    );

    await handleRunnerList(ctx, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      { id: "from-env", isDefault: true, runnerName: undefined },
      { id: "stored", isDefault: false, runnerName: "playwright" },
    ]);
  });

  // A shorter list would read as the whole truth.
  it("reports a lookup that failed rather than a partial list", async () => {
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
  });

  it("never launches a runner", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    await handleRunnerList(ctx, makeTestDeps());

    expect(callPublicApi).not.toHaveBeenCalled();
  });
});
