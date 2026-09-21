import type { ScreenshotMode } from "@qawolf/api-contracts/v1";
import { extname } from "node:path";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";

import type { SequenceAnswer } from "./performActions.js";

/** A frame with no index is the sequence's own, taken after its last action. */
export type Frame = {
  imageJpegBase64: string | undefined;
  index: number | undefined;
  path: string;
};

/** `step-3.jpg` for a frame after action 3 written to `step.jpg`. */
function indexedFramePath(out: string, index: number): string {
  const extension = extname(out);
  const stem = extension === "" ? out : out.slice(0, -extension.length);
  return `${stem}-${index}${extension}`;
}

// The frame after the last action is owed once something took effect and the
// runner answered; a sequence the runner went quiet on has no screen to show.
function isOwedAFinalFrame(answer: SequenceAnswer): boolean {
  const somethingTookEffect = answer.results.some(
    (step) => step.effect === "performed",
  );
  const runnerWentQuiet =
    "failureReason" in answer && answer.failureReason === "runner-unreachable";
  return somethingTookEffect && !runnerWentQuiet;
}

/** Every frame the mode asked the runner for, whether or not one came back. */
export function framesAskedFor(
  answer: SequenceAnswer,
  out: string,
  screenshotMode: ScreenshotMode,
): Frame[] {
  if (screenshotMode === "final") {
    const frame = {
      imageJpegBase64: answer.imageJpegBase64,
      index: undefined,
      path: out,
    };
    return frame.imageJpegBase64 === undefined && !isOwedAFinalFrame(answer)
      ? []
      : [frame];
  }
  return answer.results.flatMap((step) => {
    const imageJpegBase64 =
      "imageJpegBase64" in step ? step.imageJpegBase64 : undefined;
    // Only a performed action is owed a frame, so a refused one that came
    // back without one is not counted as missing.
    return imageJpegBase64 === undefined && step.effect !== "performed"
      ? []
      : [
          {
            imageJpegBase64,
            index: step.index,
            path: indexedFramePath(out, step.index),
          },
        ];
  });
}

/** How the frames fell short, as one sentence, or nothing when they all landed. */
export function describeShortfall(options: {
  missing: readonly Frame[];
  performedCount: number;
  unwritten: readonly { detail: string; path: string }[];
}): string | undefined {
  const { missing, performedCount, unwritten } = options;
  const missingIndexes = missing.flatMap((frame) =>
    frame.index === undefined ? [] : [frame.index],
  );
  const sentences = [
    ...(missingIndexes.length > 0
      ? [interactiveRunnerMessages.actionsFramesMissing(missingIndexes)]
      : []),
    ...(missing.some((frame) => frame.index === undefined)
      ? [
          interactiveRunnerMessages.actionsPerformedWithoutScreenshot(
            performedCount,
          ),
        ]
      : []),
    ...(unwritten.length > 0
      ? [interactiveRunnerMessages.actionsFramesUnwritable(unwritten)]
      : []),
  ];
  return sentences.length === 0
    ? undefined
    : sentences.reduce((text, sentence) => appendSentence(text, sentence));
}
