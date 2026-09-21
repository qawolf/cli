import { describe, expect, it } from "bun:test";

import { exitCodes } from "~/shell/exit.js";

import { makeAuthCtx, makeTestDeps } from "./deps.testUtils.js";
import { handleRunnerActions } from "./performActions.js";
import {
  actionsOptions,
  performed,
  sequenceAnswer,
} from "./performActions.fixtures.js";

/** A click that plainly missed at 0, then `later` at 2, with 1 performed. */
const twoFailures = (later: Record<string, unknown>) => ({
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
    performed(1),
    { index: 2, ...later },
  ],
  stoppedEarly: false,
});

describe("handleRunnerActions exit code across several failures", () => {
  it.each([
    [
      "an effect nobody can confirm",
      {
        effect: "unknown",
        failureReason: "runner-unreachable",
        outcome: "failure",
      },
      exitCodes.network,
    ],
    [
      "an action the sequence ran out of time for",
      {
        effect: "not-performed",
        failureReason: "out-of-time",
        outcome: "failure",
      },
      exitCodes.timeout,
    ],
    [
      "an action the runner refused",
      {
        effect: "not-performed",
        failureReason: "action-not-supported-on-mobile",
        outcome: "failure",
      },
      exitCodes.invalidArgs,
    ],
  ] as const)(
    "outranks an action that plainly did not happen with %s",
    async (_name, later, exitCode) => {
      const { callPublicApi, ctx } = makeAuthCtx();
      callPublicApi.mockResolvedValue({
        ok: true,
        value: sequenceAnswer(twoFailures(later)),
      });

      const result = await handleRunnerActions(
        ctx,
        actionsOptions({ continueOnFailure: true }),
        makeTestDeps(),
      );

      expect(result?.exitCode).toBe(exitCode);
    },
  );
});
