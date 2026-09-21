import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  aClick,
  actionsOptions,
  jpeg,
  performed,
  someTyping,
} from "./performActions.fixtures.js";
import { sequenceCallOptions } from "./sequenceCallOptions.js";

describe("handleRunnerActions frames", () => {
  it("asks for the final frame when a screenshot path is given, and writes it", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        imageJpegBase64: jpeg,
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      },
    });
    const deps = makeTestDeps();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick]),
        screenshot: "after.jpg",
      }),
      deps,
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.performActions,
      expect.objectContaining({ screenshotMode: "final" }),
      sequenceCallOptions,
    );
    expect(deps.written.map((write) => write.path)).toEqual(["after.jpg"]);
    expect(outputs().at(-1)?.data).toMatchObject({
      outcome: "success",
      screenshotPath: "after.jpg",
    });
    expect(JSON.stringify(outputs().at(-1)?.data)).not.toContain(jpeg);
  });

  it("writes one indexed frame per action with each", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        lastCompletedIndex: 1,
        outcome: "success",
        results: [
          { ...performed(0), imageJpegBase64: jpeg },
          { ...performed(1), imageJpegBase64: jpeg },
        ],
      },
    });
    const deps = makeTestDeps();

    await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick, someTyping]),
        screenshot: "steps/step.jpg",
        screenshotMode: "each",
      }),
      deps,
    );

    expect(deps.written.map((write) => write.path)).toEqual([
      "steps/step-0.jpg",
      "steps/step-1.jpg",
    ]);
  });

  it("points each action at its own frame when one in the middle has none", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        failedIndex: 1,
        failureReason: "action-not-supported-on-mobile",
        lastCompletedIndex: 2,
        outcome: "failure",
        results: [
          { ...performed(0), imageJpegBase64: jpeg },
          {
            effect: "not-performed",
            failureReason: "action-not-supported-on-mobile",
            index: 1,
            outcome: "failure",
          },
          { ...performed(2), imageJpegBase64: jpeg },
        ],
        stoppedEarly: false,
      },
    });
    const deps = makeTestDeps();

    await handleRunnerActions(
      ctx,
      actionsOptions({
        continueOnFailure: true,
        screenshot: "steps/step.jpg",
        screenshotMode: "each",
      }),
      deps,
    );

    expect(deps.written.map((write) => write.path)).toEqual([
      "steps/step-0.jpg",
      "steps/step-2.jpg",
    ]);
    expect(outputs().at(-1)?.data).toMatchObject({
      results: [
        { index: 0, screenshotPath: "steps/step-0.jpg" },
        { index: 1 },
        { index: 2, screenshotPath: "steps/step-2.jpg" },
      ],
    });
  });
});
