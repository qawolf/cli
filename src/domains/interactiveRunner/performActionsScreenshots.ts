import type { ScreenshotMode } from "@qawolf/api-contracts/v1";
import { extname } from "node:path";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import type { SequenceAnswer } from "./performActions.js";

/** Where the frames a sequence answered with were written. */
export type SequenceFrames = {
  /** Where the frame after an action went, by that action's index. */
  byAction: Map<number, string>;
  /** Where the frame for the sequence as a whole went. */
  final: string | undefined;
  problem: CommandResult;
};

/** A frame with no index is the sequence's own, taken after its last action. */
type Frame = {
  imageJpegBase64: string;
  index: number | undefined;
  path: string;
};

/** `step-3.jpg` for a frame after action 3 written to `step.jpg`. */
function indexedFramePath(out: string, index: number): string {
  const extension = extname(out);
  const stem = extension === "" ? out : out.slice(0, -extension.length);
  return `${stem}-${index}${extension}`;
}

function framesToWrite(
  answer: SequenceAnswer,
  out: string,
  screenshotMode: ScreenshotMode,
): Frame[] {
  if (screenshotMode === "final") {
    return answer.imageJpegBase64 === undefined
      ? []
      : [
          {
            imageJpegBase64: answer.imageJpegBase64,
            index: undefined,
            path: out,
          },
        ];
  }
  return answer.results.flatMap((step) =>
    !("imageJpegBase64" in step) || step.imageJpegBase64 === undefined
      ? []
      : [
          {
            imageJpegBase64: step.imageJpegBase64,
            index: step.index,
            path: indexedFramePath(out, step.index),
          },
        ],
  );
}

/**
 * Writes the frames the caller asked for: the sequence's own in `final` mode,
 * one per performed step in `each` mode. Nothing is written for a mode that
 * asked for none. A frame that could not be written is a problem to report
 * after the answer itself, since the actions took effect regardless.
 */
export async function writeSequenceFrames(
  options: {
    answer: SequenceAnswer;
    out: string | undefined;
    screenshotMode: ScreenshotMode;
  },
  deps: InteractiveRunnerDeps,
): Promise<SequenceFrames> {
  const { answer, out, screenshotMode } = options;
  if (out === undefined || screenshotMode === "none")
    return { byAction: new Map(), final: undefined, problem: undefined };

  const writes = await Promise.all(
    framesToWrite(answer, out, screenshotMode).map(async (frame) => ({
      frame,
      written: await deps.writeScreenshot({
        imageJpegBase64: frame.imageJpegBase64,
        path: frame.path,
      }),
    })),
  );
  const failed = writes.find((write) => !write.written.ok);
  return {
    byAction: new Map(
      writes.flatMap(({ frame }) =>
        frame.index === undefined ? [] : [[frame.index, frame.path] as const],
      ),
    ),
    final: writes.find(({ frame }) => frame.index === undefined)?.frame.path,
    problem:
      failed === undefined
        ? undefined
        : {
            error:
              interactiveRunnerMessages.actionPerformedScreenshotUnwritable(
                "sequence",
                failed.frame.path,
                failed.written.ok
                  ? ""
                  : failed.written.reason === "not-a-jpeg"
                    ? "it did not arrive as a JPEG"
                    : failed.written.detail,
              ),
            exitCode: exitCodes.network,
          },
  };
}
