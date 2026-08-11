import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRunner } from "./resolveRunner.js";

/**
 * Takes one screenshot and writes it to a file.
 *
 * A file, because that is what a foreign harness can read: every coding agent can
 * open an image on disk and none can read a base64 field out of a JSON answer.
 * The bytes are decoded on the way (see `writeScreenshot`).
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
    return { error: resolved.error, exitCode: resolved.exitCode };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.takeScreenshot,
    { id: resolved.runnerId },
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

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
  }
}
