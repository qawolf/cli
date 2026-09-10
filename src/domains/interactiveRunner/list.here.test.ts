import { describe, expect, it } from "bun:test";

import { handleRunnerList } from "./list.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { listed, onlyHere, runner, watchUrl } from "./list.testUtils.js";

describe("handleRunnerList --here", () => {
  it("keeps only this directory's runners with --here", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    const deps = makeTestDeps();
    await deps.store.rememberLaunch({ id: "ci", runnerName: "playwright" });
    callPublicApi.mockResolvedValue(
      listed(runner("elsewhere", "android"), runner("ci")),
    );

    await handleRunnerList(ctx, onlyHere, deps);

    expect(ctx.ui.json).toHaveBeenCalledWith([
      {
        id: "ci",
        isDefault: true,
        launchedHere: true,
        runnerName: "playwright",
        url: watchUrl("ci"),
      },
    ]);
  });

  it("says so when --here finds nothing but the team has runners", async () => {
    const { callPublicApi, ctx, infos } = makeAuthCtx();
    callPublicApi.mockResolvedValue(listed(runner("elsewhere")));

    await handleRunnerList(ctx, onlyHere, makeTestDeps());

    expect(infos()[0]).toContain("This directory has no runner running");
  });
});
