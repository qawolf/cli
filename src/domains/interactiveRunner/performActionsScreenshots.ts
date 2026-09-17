import type { ScreenshotMode } from "@qawolf/api-contracts/v1";
import { extname } from "node:path";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import type { SequenceAnswer } from "./performActions.js";

/** `step-3.jpg` for a frame after action 3 written to `step.jpg`. */
function indexedFramePath(out: string, index: number): string {
  const extension = extname(out);
  const stem = extension === "" ? out : out.slice(0, -extension.length);
  return `${stem}-${index}${extension}`;
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
): Promise<{ problem: CommandResult; written: string[] }> {
  const { answer, out, screenshotMode } = options;
  if (out === undefined || screenshotMode === "none")
    return { problem: undefined, written: [] };

  const frames =
    screenshotMode === "final"
      ? answer.imageJpegBase64 === undefined
        ? []
        : [{ imageJpegBase64: answer.imageJpegBase64, path: out }]
      : answer.results.flatMap((step) =>
          !("imageJpegBase64" in step) || step.imageJpegBase64 === undefined
            ? []
            : [
                {
                  imageJpegBase64: step.imageJpegBase64,
                  path: indexedFramePath(out, step.index),
                },
              ],
        );

  const writes = await Promise.all(
    frames.map(async (frame) => ({
      path: frame.path,
      written: await deps.writeScreenshot(frame),
    })),
  );
  const failed = writes.find((write) => !write.written.ok);
  return {
    problem:
      failed === undefined
        ? undefined
        : {
            error:
              interactiveRunnerMessages.actionPerformedScreenshotUnwritable(
                "sequence",
                failed.path,
                failed.written.ok
                  ? ""
                  : failed.written.reason === "not-a-jpeg"
                    ? "it did not arrive as a JPEG"
                    : failed.written.detail,
              ),
            exitCode: exitCodes.network,
          },
    written: writes.map((write) => write.path),
  };
}
