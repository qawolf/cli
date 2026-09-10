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
 * move it is pointed at is a plain `runner screenshot`, and every one exits 4,
 * the code the runner guide already reads as "take a screenshot before
 * repeating": a 2 from `act` is otherwise an argument the caller fixes and
 * re-sends, which is the double click.
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
          error:
            options.out === stdoutPath
              ? interactiveRunnerMessages.actionPerformedScreenshotStdoutUnwritable(
                  type,
                  written.detail,
                )
              : interactiveRunnerMessages.actionPerformedScreenshotUnwritable(
                  type,
                  options.out,
                  written.detail,
                ),
          exitCode: exitCodes.network,
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

/**
 * Writes the screen an action that did not take effect came back with, and folds
 * where it went into the refusal being reported.
 *
 * The refusal is the news and keeps its own exit code: the action was attempted
 * and declined, which is not made better or worse by the picture. But the
 * picture is what the caller asked for in order to see why, so a refusal that
 * carries one must not read as though nothing was written.
 */
export async function addFailureScreenshot(
  options: {
    failure: Exclude<CommandResult, void>;
    imageJpegBase64: string | undefined;
    out: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<Exclude<CommandResult, void>> {
  const note = await describeFailureScreenshot(options, deps);
  return { ...options.failure, error: `${options.failure.error} ${note}` };
}

/** Writes the refused action's screen, and says where it went. */
async function describeFailureScreenshot(
  options: { imageJpegBase64: string | undefined; out: string },
  deps: InteractiveRunnerDeps,
): Promise<string> {
  if (options.imageJpegBase64 === undefined) {
    return interactiveRunnerMessages.actionFailedWithoutScreenshot;
  }
  const written = await deps.writeScreenshot({
    imageJpegBase64: options.imageJpegBase64,
    path: options.out,
  });
  if (!written.ok) {
    return interactiveRunnerMessages.actionFailedScreenshotUnwritten(
      written.reason === "not-a-jpeg"
        ? "it did not arrive as a JPEG"
        : written.detail,
    );
  }
  return options.out === stdoutPath
    ? interactiveRunnerMessages.actionFailedScreenshotToStdout
    : interactiveRunnerMessages.actionFailedScreenshotWritten(options.out);
}
