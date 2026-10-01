import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  actionsOptions,
  performed,
  sequenceAnswer,
  someTyping,
} from "./performActions.fixtures.js";

const sequenceTimeoutMs = 180_000;

describe("handleRunnerActions on a touchscreen", () => {
  it("sends a touchscreen sequence, as runner act takes it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        lastCompletedIndex: 2,
        outcome: "success",
        results: [performed(0), performed(1), performed(2)],
      }),
    });
    const touchscreenSequence = [
      { selector: "//*[@content-desc='Email']", type: "tap" },
      { selector: "~Postal code", text: "94107", type: "fill" },
      { from: { x: 540, y: 1600 }, to: { x: 540, y: 600 }, type: "swipe" },
    ];

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ actions: JSON.stringify(touchscreenSequence) }),
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.performActions,
      {
        actions: touchscreenSequence,
        id: "ci",
        screenshotMode: "none",
        stopOnFailure: true,
      },
      { timeoutMs: sequenceTimeoutMs },
    );
  });

  it("names a touchscreen action a browser runner refused, as a bad argument", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 0,
        failureReason: "action-not-supported-on-browser",
        lastCompletedIndex: 1,
        outcome: "failure",
        results: [
          {
            effect: "not-performed",
            failureReason: "action-not-supported-on-browser",
            index: 0,
            outcome: "failure",
          },
          performed(1),
        ],
        stoppedEarly: false,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([{ type: "tap", x: 1, y: 2 }, someTyping]),
        continueOnFailure: true,
      }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("tap");
    expect(result?.error).toContain("only a mobile runner performs");
  });
});
