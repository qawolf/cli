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
export function withoutFrames(
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
export function describePerformed(
  count: number,
  frames: SequenceFrames,
): string {
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
