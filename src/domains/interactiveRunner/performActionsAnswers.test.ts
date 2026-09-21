import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

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

describe("handleRunnerActions frames and failures", () => {
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

  it("names the action that stopped the sequence, how many were left, and keeps the unknown effect from inviting a repeat", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
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
      },
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(4);
    expect(result?.error).toContain("Action 1 (type)");
    expect(result?.error).toContain("take a screenshot before repeating");
    expect(result?.error).toContain("1 action after it was not attempted");
  });

  it("exits as a test failure when an action reached the runner and did not take effect", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        errorMessage: "Target closed",
        failedIndex: 2,
        failureReason: "action-failed",
        lastCompletedIndex: 1,
        outcome: "failure",
        results: [
          performed(0),
          performed(1),
          {
            effect: "not-performed",
            errorMessage: "Target closed",
            failureReason: "action-failed",
            index: 2,
            outcome: "failure",
          },
        ],
        stoppedEarly: false,
      },
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(1);
    expect(result?.error).toBe(
      "Action 2 (keypress) reached the runner and did not take effect: Target closed.",
    );
  });

  it.each([
    [
      "a runner that is gone",
      exitCodes.notFound,
      "Runner ci is not running (HTTP 404).",
    ],
    ["a rejected key", exitCodes.auth, "Unauthorized (HTTP 401)."],
  ] as const)(
    "keeps the exit code the platform gave %s",
    async (_name, exitCode, error) => {
      const { callPublicApi, ctx } = makeAuthCtx();
      callPublicApi.mockResolvedValue({ error, exitCode, ok: false });

      const result = await handleRunnerActions(
        ctx,
        actionsOptions(),
        makeTestDeps(),
      );

      expect(result?.exitCode).toBe(exitCode);
      expect(result?.error).toBe(error);
    },
  );

  it("says which runner a lost answer was addressed to, and how it was chosen", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "Runner ci is not running (HTTP 404).",
      exitCode: exitCodes.notFound,
      ok: false,
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.errorBody).toContain("The id ci came from --runner.");
  });

  it("warns that a lost answer may still have taken effect", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      error: "The request timed out.",
      exitCode: exitCodes.network,
      mayHaveArrived: true,
      ok: false,
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toContain("take a screenshot before repeating");
  });
});
