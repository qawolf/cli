import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

type EvaluateSnippetFailure = Extract<
  z.output<typeof publicContractsV1.runner.evaluateSnippet.output>,
  { outcome: "failure" }
>;

/** Why a snippet was not evaluated, and what the caller should do about it. */
export function describeEvaluateSnippetFailure(
  failure: EvaluateSnippetFailure,
): Exclude<CommandResult, void> {
  const { failureReason } = failure;
  switch (failureReason) {
    case "runner-cannot-evaluate-snippets":
      return {
        error: interactiveRunnerMessages.runnerCannotEvaluateSnippets,
        exitCode: exitCodes.invalidArgs,
      };
    // Alone among these failure reasons, this one may have taken effect
    // before its answer was lost, so the message must not invite a bare
    // repeat.
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.snippetRunnerUnreachable,
        exitCode: exitCodes.network,
      };
    default:
      failureReason satisfies never;
      return {
        error: interactiveRunnerMessages.snippetAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
  }
}
