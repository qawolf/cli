import { describe, expect, it } from "bun:test";

import { handleRunnerExec } from "./evaluateSnippet.js";
import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";

describe("handleRunnerExec spend limit", () => {
  it("keeps the payment exit code on a spend-limit refusal", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error:
        "QA Wolf API refused the runner.evaluateSnippet request (HTTP 402): billing prevented it.",
      errorBody:
        "You have reached your monthly limit of $50.00 for runner usage.",
      exitCode: 7,
      ok: false,
    });

    const result = await handleRunnerExec(
      ctx,
      { contextFile: undefined, runner: "ci", source: "flow.ts" },
      makeTestDeps(),
    );

    expect(result?.errorBody).toContain("monthly limit");
    expect(result?.exitCode).toBe(7);
  });
});
