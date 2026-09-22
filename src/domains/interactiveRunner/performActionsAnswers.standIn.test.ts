import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  actionsOptions,
  performed,
  sequenceAnswer,
} from "./performActions.fixtures.js";

describe("handleRunnerActions on an answer with no result for the failed action", () => {
  it("reports the reason without inventing what happened to the action", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 1,
        failureReason: "action-failed",
        lastCompletedIndex: 0,
        outcome: "failure",
        results: [performed(0)],
        stoppedEarly: true,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.error).toContain("Action 1 (type)");
    expect(result?.error).toContain("no result");
    expect(result?.error).not.toContain("no reason was given");
    expect(result?.exitCode).toBe(exitCodes.network);
  });
});
