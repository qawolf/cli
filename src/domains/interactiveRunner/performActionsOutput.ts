import type { ScreenshotMode } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { stdoutPath } from "~/shell/interactiveRunner/writeScreenshot.js";

import type { SequenceAnswer } from "./performActions.js";

/** Refused before a runner is resolved, so nothing is billed for an answer that could not be written. */
export function refuseUnwritableFrames(
  ctx: AuthCommandContext,
  screenshotMode: ScreenshotMode,
  options: { screenshot: string | undefined },
): CommandResult {
  if (screenshotMode === "each" && options.screenshot === undefined) {
    return {
      error: interactiveRunnerMessages.actionsEachNeedsAPath,
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
  written: string[],
): unknown {
  const { imageJpegBase64, results, ...rest } = answer;
  return {
    ...rest,
    results: results.map((step) => {
      if (!("imageJpegBase64" in step)) return step;
      const { imageJpegBase64: frame, ...stepRest } = step;
      return frame === undefined
        ? stepRest
        : { ...stepRest, screenshotPath: written[step.index] };
    }),
    ...(imageJpegBase64 === undefined
      ? {}
      : { screenshotPath: written.at(-1) }),
  };
}
