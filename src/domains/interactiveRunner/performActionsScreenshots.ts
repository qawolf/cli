import type { ScreenshotMode } from "@qawolf/api-contracts/v1";

import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import type { SequenceAnswer } from "./performActions.js";
import {
  describeShortfall,
  framesAskedFor,
} from "./performActionsFramePlan.js";

/** Where the frames a sequence answered with were written. */
export type SequenceFrames = {
  /** Where the frame after an action went, by that action's index. */
  byAction: Map<number, string>;
  /** Where the frame for the sequence as a whole went. */
  final: string | undefined;
  problem: CommandResult;
};

/**
 * Writes the frames the caller asked for: the sequence's own in `final` mode,
 * one per performed step in `each` mode. Nothing is written for a mode that
 * asked for none. A frame that did not arrive or could not be written is a
 * problem to report after the answer itself, since the actions took effect
 * regardless.
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

  const asked = framesAskedFor(answer, out, screenshotMode);
  const arrived = asked.flatMap(({ imageJpegBase64, index, path }) =>
    imageJpegBase64 === undefined ? [] : [{ imageJpegBase64, index, path }],
  );
  const writes = await Promise.all(
    arrived.map(async (frame) => ({
      frame,
      written: await deps.writeScreenshot({
        imageJpegBase64: frame.imageJpegBase64,
        path: frame.path,
      }),
    })),
  );
  const unwritten = writes.flatMap(({ frame, written }) =>
    written.ok
      ? []
      : [
          {
            detail:
              written.reason === "not-a-jpeg"
                ? "it did not arrive as a JPEG"
                : written.detail,
            path: frame.path,
          },
        ],
  );
  const onDisk = writes
    .filter(({ written }) => written.ok)
    .map(({ frame }) => frame);
  const shortfall = describeShortfall({
    missing: asked.filter((frame) => frame.imageJpegBase64 === undefined),
    performedCount: answer.results.filter((step) => step.effect === "performed")
      .length,
    unwritten,
  });
  return {
    byAction: new Map(
      onDisk.flatMap((frame) =>
        frame.index === undefined ? [] : [[frame.index, frame.path] as const],
      ),
    ),
    final: onDisk.find((frame) => frame.index === undefined)?.path,
    problem:
      shortfall === undefined
        ? undefined
        : { error: shortfall, exitCode: exitCodes.network },
  };
}
