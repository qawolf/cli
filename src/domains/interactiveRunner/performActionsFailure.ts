import type { BrowserAction } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { SequenceAnswer } from "./performActions.js";

type SequenceFailure = Extract<SequenceAnswer, { outcome: "failure" }>;
type FailedStep = Extract<
  SequenceFailure["results"][number],
  { outcome: "failure" }
>;
type Reason = {
  errorMessage: string | undefined;
  failureReason: SequenceFailure["failureReason"];
};

/** Every action that did not succeed, why, and what the caller should do about it. */
export function describeSequenceFailure(options: {
  actions: BrowserAction[];
  answer: SequenceFailure;
}): Exclude<CommandResult, void> {
  const { actions, answer } = options;
  const failed = answer.results.flatMap((step) =>
    step.outcome === "failure" ? [reasonAt(step)] : [],
  );
  // The contract always puts the failed action in `results`. This stands in
  // for an answer that does not, so the report is never empty.
  const reported =
    failed.length > 0
      ? failed
      : [{ ...reasonOf(answer), index: answer.failedIndex }];
  const sentences = [
    ...(reported.length > 1
      ? [
          interactiveRunnerMessages.actionsNotAllSucceeded(
            reported.length,
            actions.length,
          ),
        ]
      : []),
    ...reported.map(({ index, ...reason }) =>
      interactiveRunnerMessages.actionsFailedAt(
        index,
        actions[index]?.type,
        describeReason(reason).why,
      ),
    ),
    ...(answer.stoppedEarly
      ? [
          interactiveRunnerMessages.actionsLeftUnperformed(
            actions.length - answer.results.length,
          ),
        ]
      : []),
  ];
  return {
    error: sentences.reduce((text, sentence) => appendSentence(text, sentence)),
    exitCode: describeReason(reasonOf(answer)).exitCode,
  };
}

function reasonOf(failure: FailedStep | SequenceFailure): Reason {
  return {
    errorMessage: "errorMessage" in failure ? failure.errorMessage : undefined,
    failureReason: failure.failureReason,
  };
}

function reasonAt(step: FailedStep): Reason & { index: number } {
  return { ...reasonOf(step), index: step.index };
}

function describeReason(reason: Reason): {
  exitCode: number;
  why: string;
} {
  const { failureReason } = reason;
  switch (failureReason) {
    case "action-failed":
      return {
        exitCode: exitCodes.testFailure,
        why: `reached the runner and did not take effect: ${reason.errorMessage ?? "no reason was given"}.`,
      };
    case "action-unconfirmed":
      return {
        exitCode: exitCodes.network,
        why: appendSentence(
          interactiveRunnerMessages.actionsUnconfirmed(
            reason.errorMessage ?? "the runner's screen went quiet",
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
        exitCode: exitCodes.timeout,
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
