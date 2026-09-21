import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import { exitCodes } from "~/shell/exit.js";

import type { SequenceAnswer } from "./performActions.js";

export type SequenceFailure = Extract<SequenceAnswer, { outcome: "failure" }>;
export type FailedStep = Extract<
  SequenceFailure["results"][number],
  { outcome: "failure" }
>;
/**
 * Worst first: an effect nobody can confirm outranks running out of time, a
 * refusal to act, and an action that plainly did not happen. A sequence that
 * failed several ways has to leave by the code the worst of them deserves,
 * because that is the one that decides whether repeating anything is safe.
 */
const exitCodesWorstFirst: readonly number[] = [
  exitCodes.network,
  exitCodes.timeout,
  exitCodes.invalidArgs,
  exitCodes.testFailure,
];

export function worstExitCode(codes: readonly number[]): number {
  return codes.reduce((worst, code) =>
    exitCodesWorstFirst.indexOf(code) < exitCodesWorstFirst.indexOf(worst)
      ? code
      : worst,
  );
}

export type Described = { exitCode: number; why: string };

/**
 * The contract always puts the failed action in `results`. This stands in for
 * an answer that does not, so the report is never empty and never dresses a
 * reason up as an account of what happened to the action.
 */
export function describeAnswerWithoutAResult(
  failureReason: SequenceFailure["failureReason"],
): Described {
  return {
    exitCode: exitCodes.network,
    why: interactiveRunnerMessages.actionsFailedWithoutAResult(failureReason),
  };
}

export function describeReason(step: FailedStep): Described {
  const { failureReason } = step;
  switch (failureReason) {
    case "action-failed":
      return {
        exitCode: exitCodes.testFailure,
        why: `reached the runner and did not take effect: ${step.errorMessage}.`,
      };
    case "action-unconfirmed":
      return {
        exitCode: exitCodes.network,
        why: appendSentence(
          interactiveRunnerMessages.actionsUnconfirmed(step.errorMessage),
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
