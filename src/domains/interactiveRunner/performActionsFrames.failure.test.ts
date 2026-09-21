import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  aClick,
  actionsOptions,
  jpeg,
  performed,
  sequenceAnswer,
  someTyping,
} from "./performActions.fixtures.js";

const unwritable = async () =>
  ({
    detail: "EACCES: permission denied",
    ok: false,
    reason: "unwritable",
  }) as const;

/** A click that missed at 0, then typing that went through at 1. */
const clickMissedThenTyped = (step: Record<string, unknown>) =>
  sequenceAnswer({
    errorMessage: "nothing at 480,260",
    failedIndex: 0,
    failureReason: "action-failed",
    lastCompletedIndex: 1,
    outcome: "failure",
    results: [
      {
        effect: "not-performed",
        errorMessage: "nothing at 480,260",
        failureReason: "action-failed",
        index: 0,
        outcome: "failure",
      },
      step,
    ],
    stoppedEarly: false,
  });

const eachFrameOptions = actionsOptions({
  actions: JSON.stringify([aClick, someTyping]),
  continueOnFailure: true,
  screenshot: "steps/step.jpg",
  screenshotMode: "each",
});

describe("handleRunnerActions frames alongside an action that failed", () => {
  it("keeps the exit code the failed action earned when its frame could not be written", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: clickMissedThenTyped({ ...performed(1), imageJpegBase64: jpeg }),
    });

    const result = await handleRunnerActions(
      ctx,
      eachFrameOptions,
      makeTestDeps({ writeScreenshot: unwritable }),
    );

    expect(result?.exitCode).toBe(exitCodes.testFailure);
    expect(result?.error).toContain("nothing at 480,260");
    expect(result?.error).toContain("steps/step-1.jpg");
  });

  it("says where the frames it did write are", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: clickMissedThenTyped({ ...performed(1), imageJpegBase64: jpeg }),
    });

    const result = await handleRunnerActions(
      ctx,
      eachFrameOptions,
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.testFailure);
    expect(result?.error).toContain("written to steps/step-1.jpg");
  });

  it("keeps the unknown effect's exit code when the runner answered without a final frame", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        failedIndex: 1,
        failureReason: "runner-unreachable",
        lastCompletedIndex: 0,
        outcome: "failure",
        results: [
          performed(0),
          {
            effect: "unknown",
            failureReason: "runner-unreachable",
            index: 1,
            outcome: "failure",
          },
        ],
        stoppedEarly: true,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick, someTyping]),
        screenshot: "after.jpg",
      }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toContain("the runner stopped answering");
    expect(result?.error).toContain("without the screen it was asked for");
  });
});
