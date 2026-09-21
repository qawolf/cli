import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

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

describe("handleRunnerActions frames", () => {
  it("asks for the final frame when a screenshot path is given, and writes it", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        imageJpegBase64: jpeg,
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      }),
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
      expect.anything(),
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
      value: sequenceAnswer({
        lastCompletedIndex: 1,
        outcome: "success",
        results: [
          { ...performed(0), imageJpegBase64: jpeg },
          { ...performed(1), imageJpegBase64: jpeg },
        ],
      }),
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
      value: sequenceAnswer({
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
      }),
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

  it("does not report a frame as written when the write failed", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        imageJpegBase64: jpeg,
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick]),
        screenshot: "after.jpg",
      }),
      makeTestDeps({ writeScreenshot: unwritable }),
    );

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toContain("after.jpg");
    expect(outputs().at(-1)?.humanMessage).toBe("Performed 1 action.");
    expect(outputs().at(-1)?.data).not.toHaveProperty("screenshotPath");
  });

  it("names every frame it could not write", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        lastCompletedIndex: 1,
        outcome: "success",
        results: [
          { ...performed(0), imageJpegBase64: jpeg },
          { ...performed(1), imageJpegBase64: jpeg },
        ],
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick, someTyping]),
        screenshot: "steps/step.jpg",
        screenshotMode: "each",
      }),
      makeTestDeps({ writeScreenshot: unwritable }),
    );

    expect(result?.error).toContain("steps/step-0.jpg");
    expect(result?.error).toContain("steps/step-1.jpg");
  });

  it("keeps the confirmation off stdout when the frame goes there", async () => {
    const { callPublicApi, ctx, outputs, successes } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        imageJpegBase64: jpeg,
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      }),
    });
    const deps = makeTestDeps();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ actions: JSON.stringify([aClick]), screenshot: "-" }),
      deps,
    );

    expect(result).toBeUndefined();
    expect(deps.stdoutWrites).toHaveLength(1);
    expect(outputs()).toEqual([]);
    expect(successes().at(-1)).toContain("stdout");
  });
});
