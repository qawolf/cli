import type { ScreenshotMode } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { stdoutPath } from "~/shell/interactiveRunner/writeScreenshot.js";

import type { SequenceAnswer } from "./performActions.js";
import type { SequenceFrames } from "./performActionsScreenshots.js";

/** Refused before a runner is resolved, so nothing is billed for an answer that could not be written. */
export function refuseUnwritableFrames(
  ctx: AuthCommandContext,
  screenshotMode: ScreenshotMode,
  options: { screenshot: string | undefined },
): CommandResult {
  // Refused rather than ignored, for the same reason an action flag beside a
  // piped action is: a flag that changes nothing has to be answered.
  if (screenshotMode === "none" && options.screenshot !== undefined) {
    return {
      error: interactiveRunnerMessages.actionsScreenshotWithModeNone,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (screenshotMode !== "none" && options.screenshot === undefined) {
    return {
      error:
        screenshotMode === "each"
          ? interactiveRunnerMessages.actionsEachNeedsAPath
          : interactiveRunnerMessages.actionsFinalNeedsAPath,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (screenshotMode === "each" && options.screenshot === stdoutPath) {
    return {
      error: interactiveRunnerMessages.actionsEachToStdout,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (options.screenshot === stdoutPath && ctx.outputMode === "human") {
    return {
      error: interactiveRunnerMessages.stdoutIsATerminal("--screenshot"),
      exitCode: exitCodes.invalidArgs,
    };
  }
  return undefined;
}

/** The answer as data, with every frame replaced by where it was written. */
function withoutFrames(
  answer: SequenceAnswer,
  frames: SequenceFrames,
): unknown {
  const { imageJpegBase64: _final, results, ...rest } = answer;
  return {
    ...rest,
    results: results.map((step) => {
      if (!("imageJpegBase64" in step)) return step;
      const { imageJpegBase64: _frame, ...stepRest } = step;
      const path = frames.byAction.get(step.index);
      return path === undefined
        ? stepRest
        : { ...stepRest, screenshotPath: path };
    }),
    ...(frames.final === undefined ? {} : { screenshotPath: frames.final }),
  };
}

/** What a sequence that performed every action says it did, and where its frames went. */
function describePerformed(count: number, frames: SequenceFrames): string {
  if (frames.final === stdoutPath) {
    return interactiveRunnerMessages.actionsPerformedScreenshotToStdout(count);
  }
  if (frames.final !== undefined) {
    return interactiveRunnerMessages.actionsPerformedScreenshotWritten(
      count,
      frames.final,
    );
  }
  if (frames.byAction.size > 0) {
    return interactiveRunnerMessages.actionsPerformedFramesWritten(count, [
      ...frames.byAction.values(),
    ]);
  }
  return interactiveRunnerMessages.actionsPerformed(count);
}

/**
 * Where the frames of a failed sequence went, as a sentence for the end of the
 * refusal being reported.
 *
 * The refusal is the news and keeps its own exit code: an action was attempted
 * and declined, which the picture neither improves nor worsens. But the picture
 * is what the caller asked for in order to see why, so a refusal that carries
 * one must not read as though nothing was written.
 */
export function describeFailureFrames(
  frames: SequenceFrames,
): string | undefined {
  if (frames.problem !== undefined) return frames.problem.error;
  if (frames.final === stdoutPath) {
    return interactiveRunnerMessages.actionsFailedScreenshotToStdout;
  }
  const paths = [
    ...(frames.final === undefined ? [] : [frames.final]),
    ...frames.byAction.values(),
  ];
  return paths.length === 0
    ? undefined
    : interactiveRunnerMessages.actionsFailedFramesWritten(paths);
}

/**
 * Says what the sequence did, and hands its results over as data.
 *
 * A sequence that failed says only how much of it went through, because the
 * refusal itself is reported on stderr and printing it here as well would say
 * the whole thing twice. With the frame on stdout the image is the output, so
 * nothing else may go there: the confirmation moves to stderr the way
 * `runner screenshot --out -` moves it, and a refused sequence needs no line of
 * its own at all.
 */
export function reportSequence(
  ctx: AuthCommandContext,
  options: {
    actionCount: number;
    answer: SequenceAnswer;
    failed: boolean;
    frames: SequenceFrames;
    toStdout: boolean;
  },
): void {
  const { answer, frames } = options;
  const message = options.failed
    ? interactiveRunnerMessages.actionsPerformedOfTotal(
        answer.results.filter((step) => step.effect === "performed").length,
        options.actionCount,
      )
    : describePerformed(answer.results.length, frames);
  if (!options.toStdout) {
    ctx.ui.output(withoutFrames(answer, frames), message);
    return;
  }
  if (!options.failed) ctx.ui.success(message);
}
