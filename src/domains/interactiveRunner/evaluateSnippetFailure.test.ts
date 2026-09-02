import { describe, expect, it } from "bun:test";

import { handleRunnerExec } from "./evaluateSnippet.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

describe("handleRunnerExec failure reasons", () => {
  it("names the no-live-page case, which retrying never clears", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        failureReason: "runner-cannot-evaluate-snippets",
        outcome: "failure",
      },
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("no live page");
    // A fresh playwright runner does run a browser, so telling the
    // caller to check the image would send them after the wrong thing.
    expect(result?.error).toContain("run a flow on it with qawolf runner run");
    expect(result?.error).toContain("not proof the snippet did not run");
    expect(result?.exitCode).toBe(2);
  });

  it("tells an unreachable runner apart, as retryable", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: { failureReason: "runner-unreachable", outcome: "failure" },
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.error).toContain("could not be reached");
    expect(result?.exitCode).toBe(4);
  });
});
