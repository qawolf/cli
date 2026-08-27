import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

type PerformActionFailure = Extract<
  z.output<typeof publicContractsV1.runner.performAction.output>,
  { outcome: "failure" }
>;

/** Why an action was refused, and what the caller should do about it. */
export function describePerformActionFailure(options: {
  actionType: string;
  failure: PerformActionFailure;
}): Exclude<CommandResult, void> {
  const { actionType, failure } = options;
  const { failureReason } = failure;
  switch (failureReason) {
    // Attempted and did not take effect, which is an answer rather than a fault.
    case "action-failed":
      return {
        error: interactiveRunnerMessages.actionFailed(failure.errorMessage),
        exitCode: exitCodes.testFailure,
      };
    case "action-not-supported-on-mobile":
      return {
        error: interactiveRunnerMessages.actionNotSupportedOnMobile(actionType),
        exitCode: exitCodes.invalidArgs,
      };
    case "screen-needs-a-run":
      return {
        error: interactiveRunnerMessages.screenNeedsARun,
        exitCode: exitCodes.invalidArgs,
      };
    case "screen-not-ready":
      return {
        error: interactiveRunnerMessages.screenNotReady,
        exitCode: exitCodes.network,
      };
    case "runner-has-no-screen":
      return {
        error: interactiveRunnerMessages.runnerHasNoScreen,
        exitCode: exitCodes.invalidArgs,
      };
    // Alone among these verbs, this one may have taken effect before its answer
    // was lost, so the message must not invite a bare repeat.
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.actionMayHaveHappened,
        exitCode: exitCodes.network,
      };
    default: {
      failureReason satisfies never;
      return {
        error: interactiveRunnerMessages.actionAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
    }
  }
}
