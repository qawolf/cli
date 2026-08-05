import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";

/**
 * Takes one screenshot and writes it to a file.
 *
 * A file, because that is what a foreign harness can read: every coding agent can
 * open an image on disk and none can read a base64 field out of a JSON answer.
 * The bytes are decoded on the way (see `writeScreenshot`).
 *
 * The three non-image answers are kept apart at the terminal and in `--json`,
 * because only one of them is worth trying again. A caller that cannot tell
 * `screen-not-ready` from `runner-has-no-screen` either gives up on a screen that
 * was seconds from being up, or retries for ever against a runner that has none.
 */
export async function handleRunnerScreenshot(
  ctx: AuthCommandContext,
  options: { out: string; runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { error: resolved.error, exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.takeScreenshot,
    { id: resolved.runnerId },
  );
  if (!result.ok) return { error: result.error, exitCode: exitCodes.network };

  switch (result.value.outcome) {
    case "captured": {
      const written = await deps.writeScreenshot({
        imageJpegBase64: result.value.imageJpegBase64,
        path: options.out,
      });
      // A payload that is not an image is the API's to fix, not the caller's;
      // a path that cannot be written is the other way round.
      if (!written.ok) {
        return written.reason === "not-a-jpeg"
          ? {
              error: interactiveRunnerMessages.screenshotNotAnImage,
              exitCode: exitCodes.network,
            }
          : {
              error: interactiveRunnerMessages.screenshotUnwritable(
                options.out,
                written.detail,
              ),
              exitCode: exitCodes.invalidArgs,
            };
      }
      ctx.ui.output(
        { outcome: "captured", path: options.out },
        interactiveRunnerMessages.screenshotWritten(options.out),
      );
      return undefined;
    }
    // Transient: the desktop starts with the runner's first run, and it serves
    // one see-or-act request at a time.
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
  }
}
