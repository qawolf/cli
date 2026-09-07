import type { BrowserActionFlags } from "~/core/interactiveRunner/browserAction.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { stdoutPath } from "~/shell/interactiveRunner/writeScreenshot.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { performActionContract } from "./performActionContract.js";
import { describePerformActionFailure } from "./performActionFailure.js";
import { writeActionScreenshot } from "./performActionScreenshot.js";
import { readAction } from "./readAction.js";
import { runnerCallOptions } from "./runnerCallOptions.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";

/**
 * Performs one raw browser action.
 *
 * One per call, and the runner serves one at a time, so there is no queue and the
 * caller decides what to do next from each answer. The action is admitted by the
 * published schema before it is sent, which is what turns a string too long for
 * the runner's keyboard into an immediate refusal naming the limit rather than a
 * round trip that holds the runner for ten seconds and then declines.
 *
 * With `screenshot` set, the runner is asked to answer with its screen once it
 * has settled after the action, and the image is written the way
 * `runner screenshot` writes one. One call per step instead of two, and the
 * fixed wait a caller put between them goes away, because the runner waits for
 * the frame to change rather than the caller guessing how long that takes.
 */
export async function handleRunnerAct(
  ctx: AuthCommandContext,
  options: {
    flags: BrowserActionFlags;
    runner: string | undefined;
    /** Where to write the screen that comes with the answer; `-` for stdout. */
    screenshot: string | undefined;
    type: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const built = await readAction(options.type, options.flags, deps);
  if (!built.ok) return { error: built.error, exitCode: exitCodes.invalidArgs };

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);
  // Only a terminal on stdout selects human mode, and a terminal cannot read
  // JPEG bytes. Refused before the action rather than after it, so the caller
  // is not left with an action that happened and a screen it cannot get.
  if (options.screenshot === stdoutPath && ctx.outputMode === "human") {
    return {
      error: interactiveRunnerMessages.stdoutIsATerminal("--screenshot"),
      exitCode: exitCodes.invalidArgs,
    };
  }

  const result = await ctx.platformClient.callPublicApi(
    performActionContract,
    {
      action: built.action,
      id: resolved.runnerId,
      ...(options.screenshot === undefined ? {} : { screenshot: true }),
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    // A lost answer at the transport is the same hazard as the unreachable
    // outcome below: the action may have taken effect before the answer was
    // lost, so this failure must not invite a bare repeat either.
    const fields = failureFields(result);
    return {
      ...fields,
      ...(result.mayHaveArrived
        ? {
            error: `${fields.error} ${interactiveRunnerMessages.actionMayHaveHappened}`,
          }
        : {}),
      exitCode: exitCodes.network,
    };
  }

  if (result.value.outcome === "success") {
    if (options.screenshot !== undefined) {
      return writeActionScreenshot(
        ctx,
        {
          action: built.action,
          imageJpegBase64: result.value.imageJpegBase64,
          out: options.screenshot,
        },
        deps,
      );
    }
    ctx.ui.output(
      { action: built.action, outcome: "success" },
      interactiveRunnerMessages.actionPerformed(built.action.type),
    );
    return undefined;
  }

  return describePerformActionFailure({
    actionType: built.action.type,
    failure: result.value,
  });
}
