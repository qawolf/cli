import type { BrowserAction } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { SequenceAnswer } from "./performActions.js";

type SequenceFailure = Extract<SequenceAnswer, { outcome: "failure" }>;

/** Why the sequence stopped, at which action, and what the caller should do about it. */
export function describeSequenceFailure(options: {
  actions: BrowserAction[];
  answer: SequenceFailure;
}): Exclude<CommandResult, void> {
  const { actions, answer } = options;
  const type = actions[answer.failedIndex]?.type ?? "action";
  const described = describeReason(answer);
  const unperformed = answer.stoppedEarly
    ? interactiveRunnerMessages.actionsLeftUnperformed(
        actions.length - answer.results.length,
      )
    : undefined;
  const error = interactiveRunnerMessages.actionsStoppedAt(
    answer.failedIndex,
    type,
    described.why,
  );
  return {
    error:
      unperformed === undefined ? error : appendSentence(error, unperformed),
    exitCode: described.exitCode,
  };
}

function describeReason(answer: SequenceFailure): {
  exitCode: number;
  why: string;
} {
  const { failureReason } = answer;
  switch (failureReason) {
    case "action-failed":
      return {
        exitCode: exitCodes.testFailure,
        why: `reached the runner and did not take effect: ${answer.errorMessage ?? "no reason was given"}.`,
      };
    case "action-unconfirmed":
      return {
        exitCode: exitCodes.network,
        why: appendSentence(
          interactiveRunnerMessages.actionsUnconfirmed(
            answer.errorMessage ?? "the runner's screen went quiet",
          ),
          interactiveRunnerMessages.actionsMayHaveHappened,
        ),
      };
    case "runner-unreachable":
      return {
        exitCode: exitCodes.network,
        why: appendSentence(
          "could not be confirmed: the runner stopped answering.",
          interactiveRunnerMessages.actionsMayHaveHappened,
        ),
      };
    case "out-of-time":
      return {
        exitCode: exitCodes.network,
        why: interactiveRunnerMessages.actionsOutOfTime,
      };
    case "action-not-supported-on-mobile":
      return {
        exitCode: exitCodes.invalidArgs,
        why: "has no touchscreen equivalent on a mobile runner.",
      };
    case "screen-needs-a-run":
      return {
        exitCode: exitCodes.invalidArgs,
        why: `was refused: ${interactiveRunnerMessages.screenNeedsARun}`,
      };
    case "runner-has-no-screen":
      return {
        exitCode: exitCodes.invalidArgs,
        why: `was refused: ${interactiveRunnerMessages.runnerHasNoScreen}`,
      };
    case "screen-not-ready":
      return {
        exitCode: exitCodes.network,
        why: `was refused: ${interactiveRunnerMessages.screenNotReady}`,
      };
    default: {
      failureReason satisfies never;
      return {
        exitCode: exitCodes.network,
        why: interactiveRunnerMessages.actionAnsweredUnknown(failureReason),
      };
    }
  }
}
