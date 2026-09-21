import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  actionsOptions,
  performed,
  sequenceAnswer,
} from "./performActions.fixtures.js";

describe("handleRunnerActions on a sequence that was partly applied", () => {
  it("does not let a screen that cannot serve invite a retry of the whole sequence", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 2,
        failureReason: "screen-not-ready",
        lastCompletedIndex: 1,
        outcome: "failure",
        results: [
          performed(0),
          performed(1),
          {
            effect: "not-performed",
            failureReason: "screen-not-ready",
            index: 2,
            outcome: "failure",
          },
        ],
        stoppedEarly: true,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.error).toContain(
      "action 1 is the last one that took effect",
    );
    expect(result?.error).toContain("new request");
  });

  it("does not let an action a mobile runner cannot take invite a re-send of the whole sequence", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 1,
        failureReason: "action-not-supported-on-mobile",
        lastCompletedIndex: 0,
        outcome: "failure",
        results: [
          performed(0),
          {
            effect: "not-performed",
            failureReason: "action-not-supported-on-mobile",
            index: 1,
            outcome: "failure",
          },
        ],
        stoppedEarly: true,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.error).toContain(
      "action 0 is the last one that took effect",
    );
  });

  it("says nothing about a partial apply when the first action already failed", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 0,
        failureReason: "screen-needs-a-run",
        outcome: "failure",
        results: [
          {
            effect: "not-performed",
            failureReason: "screen-needs-a-run",
            index: 0,
            outcome: "failure",
          },
        ],
        stoppedEarly: true,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.error).not.toContain("partly applied");
  });
});
