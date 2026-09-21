import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { describe, expect, it } from "bun:test";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  aClick,
  actionsOptions,
  anEnter,
  performed,
  someTyping,
} from "./performActions.fixtures.js";
import { sequenceCallOptions } from "./sequenceCallOptions.js";

describe("handleRunnerActions", () => {
  it("sends the sequence in one request, asking for no frame when none is wanted", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        lastCompletedIndex: 2,
        outcome: "success",
        results: [performed(0), performed(1), performed(2)],
      },
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
      sequenceCallOptions,
    );
    expect(outputs().at(-1)?.humanMessage).toBe("Performed 3 actions.");
  });

  it("reads the sequence from stdin with -", async () => {
    const { callPublicApi, ctx } = makeAuthCtx();
    callPublicApi.mockResolvedValue({
      ok: true,
      value: {
        lastCompletedIndex: 0,
        outcome: "success",
        results: [performed(0)],
      },
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
      sequenceCallOptions,
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
