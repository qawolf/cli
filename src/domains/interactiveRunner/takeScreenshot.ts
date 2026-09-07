import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import {
  type ScreenshotWrite,
  stdoutPath,
} from "~/shell/interactiveRunner/writeScreenshot.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

/**
 * Takes one screenshot and writes it to a file, or to stdout when `out` is `-`.
 *
 * A file by default, because that is what a foreign harness can read: every
 * coding agent can open an image on disk and none can read a base64 field out of
 * a JSON answer. Stdout for the caller that is a process rather than an agent,
 * which would otherwise reserve a path, run the command, read the file back and
 * delete it on every step. The bytes are decoded either way (see
 * `writeScreenshot`).
 *
 * With stdout taken by the image, the confirmation moves to stderr, JSON
 * included, so nothing follows the bytes into a reader that takes stdout as the
 * file. A terminal on stdout is refused, since nothing there can read them.
 *
 * The four non-image answers are kept apart at the terminal and in `--json`,
 * because each implies a different next move and only one of them is retrying.
 * A caller that cannot tell them apart gives up on a screen that was seconds from
 * being up, retries for ever against a runner that has none, or waits out a
 * runner that only needs a run.
 */
export async function handleRunnerScreenshot(
  ctx: AuthCommandContext,
  options: { out: string; runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // Never launches: the virtual desktop starts with the runner's first run, so a
  // runner started for this command could only answer `screen-needs-a-run`.
  const resolved = await resolveRunner(
    ctx,
    {
      autoLaunch: false,
      noRunnerIdMessage: interactiveRunnerMessages.noRunnerIdForScreenshot,
      runner: options.runner,
    },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }
  // Only a terminal on stdout selects human mode, and a terminal cannot read
  // JPEG bytes; the confirmation would land among them rather than on stderr.
  if (options.out === stdoutPath && ctx.outputMode === "human") {
    return {
      error: interactiveRunnerMessages.stdoutIsATerminal("--out"),
      exitCode: exitCodes.invalidArgs,
    };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.takeScreenshot,
    { id: resolved.runnerId },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  if (result.value.outcome === "success") {
    const written = await deps.writeScreenshot({
      imageJpegBase64: result.value.imageJpegBase64,
      path: options.out,
    });
    if (!written.ok) return describeUnwritten(written, options.out);
    if (options.out === stdoutPath) {
      ctx.ui.success(interactiveRunnerMessages.screenshotWrittenToStdout);
    } else {
      ctx.ui.output(
        { outcome: "success", path: options.out },
        interactiveRunnerMessages.screenshotWritten(options.out),
      );
    }
    return undefined;
  }

  const { failureReason } = result.value;
  switch (failureReason) {
    // Permanent until the caller acts, so not a retry: only a run starts the
    // desktop, and waiting is what a caller does with `screen-not-ready`.
    case "screen-needs-a-run":
      return {
        error: interactiveRunnerMessages.screenNeedsARun,
        exitCode: exitCodes.invalidArgs,
      };
    // Transient: the desktop restarts when a run changes the display size, and it
    // serves one see-or-act request at a time.
    case "screen-not-ready":
      return {
        error: interactiveRunnerMessages.screenNotReady,
        exitCode: exitCodes.network,
      };
    // Permanent, and the caller's to fix by launching a different image.
    case "runner-has-no-screen":
      return {
        error: interactiveRunnerMessages.runnerHasNoScreen,
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
    default: {
      failureReason satisfies never;
      return {
        error:
          interactiveRunnerMessages.screenshotAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
    }
  }
}

// A payload that is not an image is the API's to fix, not the caller's; a
// destination that cannot be written is the other way round.
function describeUnwritten(
  written: Exclude<ScreenshotWrite, { ok: true }>,
  out: string,
): Exclude<CommandResult, void> {
  if (written.reason === "not-a-jpeg") {
    return {
      error: interactiveRunnerMessages.screenshotNotAnImage,
      exitCode: exitCodes.network,
    };
  }
  return {
    error:
      out === stdoutPath
        ? interactiveRunnerMessages.screenshotStdoutUnwritable(written.detail)
        : interactiveRunnerMessages.screenshotUnwritable(out, written.detail),
    exitCode: exitCodes.invalidArgs,
  };
}
