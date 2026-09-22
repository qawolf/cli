import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  aClick,
  actionsOptions,
  anEnter,
  performed,
  sequenceAnswer,
  someTyping,
} from "./performActions.fixtures.js";

/** A sequence starts a browser, then runs every action, then takes a frame. */
const sequenceTimeoutMs = 180_000;

describe("handleRunnerActions", () => {
  it("sends the sequence in one request, asking for no frame when none is wanted", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        lastCompletedIndex: 2,
        outcome: "success",
        results: [performed(0), performed(1), performed(2)],
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions(),
      makeTestDeps(),
    );

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.performActions,
      {
        actions: [aClick, someTyping, anEnter],
        id: "ci",
        screenshotMode: "none",
        stopOnFailure: true,
      },
      { timeoutMs: sequenceTimeoutMs },
    );
    expect(outputs().at(-1)?.humanMessage).toBe("Performed 3 actions.");
  });

  it("reads the sequence from stdin with -", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      }),
    });

    await handleRunnerActions(
      ctx,
      actionsOptions({ actions: "-", continueOnFailure: true }),
      makeTestDeps({ readStdin: async () => `${JSON.stringify([aClick])}\n` }),
    );

    expect(callPublicApi).toHaveBeenCalledWith(
      publicContractsV1.runner.performActions,
      {
        actions: [aClick],
        id: "ci",
        screenshotMode: "none",
        stopOnFailure: false,
      },
      { timeoutMs: sequenceTimeoutMs },
    );
  });

  it("refuses a sequence with one bad action locally, naming its index", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([
          aClick,
          { text: "a".repeat(201), type: "type" },
        ]),
      }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("Action 1 in the sequence was refused");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});

describe("handleRunnerActions frame refusals", () => {
  it("refuses each with nowhere to write its frames", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ screenshotMode: "each" }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("needs --screenshot <path>");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses final with nowhere to write its frame, rather than capturing one and dropping it", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ screenshotMode: "final" }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("needs --screenshot <path>");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses each to stdout, which cannot carry one frame per action", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ screenshot: "-", screenshotMode: "each" }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a path to write to when the mode asks the runner for no frame", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ screenshot: "after.jpg", screenshotMode: "none" }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("--screenshot-mode none");
    expect(callPublicApi).not.toHaveBeenCalled();
  });

  it("refuses a frame on stdout when stdout is a terminal", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ screenshot: "-" }),
      makeTestDeps(),
    );

    expect(result?.exitCode).toBe(2);
    expect(result?.error).toContain("Stdout is a terminal");
    expect(callPublicApi).not.toHaveBeenCalled();
  });
});

describe("handleRunnerActions reporting", () => {
  it("does not say the same thing twice, once as the data line and again as the error", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        errorMessage: "nothing at 480,260",
        failedIndex: 0,
        failureReason: "action-failed",
        lastCompletedIndex: 2,
        outcome: "failure",
        results: [
          {
            effect: "not-performed",
            errorMessage: "nothing at 480,260",
            failureReason: "action-failed",
            index: 0,
            outcome: "failure",
          },
          performed(1),
          performed(2),
        ],
        stoppedEarly: false,
      }),
    });

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({ continueOnFailure: true }),
      makeTestDeps(),
    );

    expect(outputs().at(-1)?.humanMessage).toBe("Performed 2 of 3 actions.");
    expect(outputs().at(-1)?.humanMessage).not.toBe(result?.error);
  });
});
