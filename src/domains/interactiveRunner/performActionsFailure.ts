import type { BrowserAction } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import type { CommandResult } from "~/shell/commandContext.js";

import {
  describeAnswerWithoutAResult,
  describeReason,
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
    step.outcome === "failure" ? [step] : [],
  );
  const described =
    failed.length > 0
      ? failed.map((step) => ({ index: step.index, ...describeReason(step) }))
      : [
          {
            index: answer.failedIndex,
            ...describeAnswerWithoutAResult(answer.failureReason),
          },
        ];
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
