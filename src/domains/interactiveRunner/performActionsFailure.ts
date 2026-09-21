import type { BrowserAction } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import type { CommandResult } from "~/shell/commandContext.js";

import {
  describeReason,
  type FailedStep,
  type Reason,
  type SequenceFailure,
  worstExitCode,
} from "./performActionsReasons.js";

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
  const described = reported.map(({ index, ...reason }) => ({
    index,
    ...describeReason(reason),
  }));
  const sentences = [
    ...(described.length > 1
      ? [
          interactiveRunnerMessages.actionsNotAllSucceeded(
            described.length,
            actions.length,
          ),
        ]
      : []),
    ...described.map(({ index, why }) =>
      interactiveRunnerMessages.actionsFailedAt(
        index,
        actions[index]?.type,
        why,
      ),
    ),
    ...(answer.stoppedEarly
      ? [
          interactiveRunnerMessages.actionsLeftUnperformed(
            actions.length - answer.results.length,
          ),
        ]
      : []),
    ...(answer.lastCompletedIndex === undefined
      ? []
      : [
          interactiveRunnerMessages.actionsPartlyApplied(
            answer.lastCompletedIndex,
          ),
        ]),
  ];
  return {
    error: sentences.reduce((text, sentence) => appendSentence(text, sentence)),
    exitCode: worstExitCode(described.map(({ exitCode }) => exitCode)),
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
