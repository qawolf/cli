import type { BrowserAction } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { stdoutPath } from "~/shell/interactiveRunner/writeScreenshot.js";

import type { InteractiveRunnerDeps } from "./deps.js";

/**
 * Writes the screen that came back with a performed action, the way
 * `runner screenshot` writes one: decoded, to a file or to stdout with `-`.
 *
 * Every failure here follows a success: the action took effect before the
 * image went wrong. So each message says so and none invites a repeat, because
 * a caller that re-sends a click to get its screenshot clicks twice. The next
 * move it is pointed at is a plain `runner screenshot`.
 */
export async function writeActionScreenshot(
  ctx: AuthCommandContext,
  options: {
    action: BrowserAction;
    imageJpegBase64: string | undefined;
    out: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const { type } = options.action;
  // The API's to fix, not the caller's, so a 4 like a screenshot that is not one.
  if (options.imageJpegBase64 === undefined) {
    return {
      error: interactiveRunnerMessages.actionPerformedWithoutScreenshot(type),
      exitCode: exitCodes.network,
    };
  }

  const written = await deps.writeScreenshot({
    imageJpegBase64: options.imageJpegBase64,
    path: options.out,
  });
  if (!written.ok) {
    return written.reason === "not-a-jpeg"
      ? {
          error:
            interactiveRunnerMessages.actionPerformedScreenshotNotAnImage(type),
          exitCode: exitCodes.network,
        }
      : {
          error: interactiveRunnerMessages.actionPerformedScreenshotUnwritable(
            type,
            options.out === stdoutPath ? "stdout" : `"${options.out}"`,
            written.detail,
          ),
          exitCode: exitCodes.invalidArgs,
        };
  }

  // Stdout is the image, so the confirmation moves to stderr in every mode,
  // JSON included, the same as `runner screenshot --out -`.
  if (options.out === stdoutPath) {
    ctx.ui.success(
      interactiveRunnerMessages.actionPerformedScreenshotToStdout(type),
    );
    return undefined;
  }
  ctx.ui.output(
    { action: options.action, outcome: "success", screenshotPath: options.out },
    interactiveRunnerMessages.actionPerformedScreenshotWritten(
      type,
      options.out,
    ),
  );
  return undefined;
}
