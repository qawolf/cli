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

describe("handleRunnerActions frames that never arrived", () => {
  it("refuses a final frame the runner answered without, rather than exiting clean with nothing written", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
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

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toContain("without the screen it was asked for");
    expect(deps.written).toEqual([]);
  });

  it("writes no bytes to stdout when the frame it would hold never arrived", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
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

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(deps.stdoutWrites).toEqual([]);
  });

  it("names every action the runner answered without a frame for", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: sequenceAnswer({
        lastCompletedIndex: 1,
        outcome: "success",
        results: [{ ...performed(0), imageJpegBase64: jpeg }, performed(1)],
      }),
    });
    const deps = makeTestDeps();

    const result = await handleRunnerActions(
      ctx,
      actionsOptions({
        actions: JSON.stringify([aClick, someTyping]),
        screenshot: "steps/step.jpg",
        screenshotMode: "each",
      }),
      deps,
    );

    expect(result?.exitCode).toBe(exitCodes.network);
    expect(result?.error).toContain("action 1");
    expect(deps.written.map((write) => write.path)).toEqual([
      "steps/step-0.jpg",
    ]);
  });
});
