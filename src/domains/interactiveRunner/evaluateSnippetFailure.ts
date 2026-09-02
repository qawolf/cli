import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { exitCodes } from "~/shell/exit.js";

type EvaluateSnippetFailure = Extract<
  z.output<typeof publicContractsV1.runner.evaluateSnippet.output>,
  { outcome: "failure" }
>;

/** Why a snippet was not evaluated, and what the caller should do about it. */
export type EvaluateSnippetRefusal = {
  error: string;
  exitCode: number;
};

export function describeEvaluateSnippetFailure(
  failure: EvaluateSnippetFailure,
): EvaluateSnippetRefusal {
  const { failureReason } = failure;
  switch (failureReason) {
    case "runner-cannot-evaluate-snippets":
      return {
        error: interactiveRunnerMessages.runnerHasNoScreenToEvaluate,
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
    default:
      failureReason satisfies never;
      return {
        error: interactiveRunnerMessages.evaluateAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
  }
}
