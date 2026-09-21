import type { ScreenshotMode } from "@qawolf/api-contracts/v1";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { appendSentence } from "~/core/sentences.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { describeSequenceFailure } from "./performActionsFailure.js";
import {
  refuseUnwritableFrames,
  withoutFrames,
} from "./performActionsOutput.js";
import { writeSequenceFrames } from "./performActionsScreenshots.js";
import { readActions } from "./readActions.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";
import { runnerRequestFailure } from "./runnerRequestFailure.js";
import { sequenceCallOptions } from "./sequenceCallOptions.js";

export type SequenceAnswer = z.output<
  typeof publicContractsV1.runner.performActions.output
>;

/**
 * Performs a sequence of raw browser actions in one request.
 *
 * The platform sends the whole sequence to the runner, which performs the
 * screen actions as one input batch, so a caller that already knows its next
 * steps pays one round trip instead of one per step. The frames the caller
 * asked for are written the way `runner screenshot` writes one, and the
 * answer's base64 is not echoed: a sequence's worth of images is not something
 * a terminal or a JSON reader wants inline.
 */
export async function handleRunnerActions(
  ctx: AuthCommandContext,
  options: {
    actions: string;
    continueOnFailure: boolean;
    runner: string | undefined;
    /** Where to write the frame; with `each`, one file per action, indexed. */
    screenshot: string | undefined;
    screenshotMode: ScreenshotMode | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const read = await readActions(options.actions, deps);
  if (!read.ok) return { error: read.error, exitCode: exitCodes.invalidArgs };

  const screenshotMode: ScreenshotMode =
    options.screenshotMode ??
    (options.screenshot === undefined ? "none" : "final");
  const refusedLocally = refuseUnwritableFrames(ctx, screenshotMode, options);
  if (refusedLocally !== undefined) return refusedLocally;

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed")
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  announceRunner(ctx, resolved);

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.performActions,
    {
      actions: read.actions,
      id: resolved.runnerId,
      screenshotMode,
      stopOnFailure: !options.continueOnFailure,
    },
    sequenceCallOptions,
  );
  if (!result.ok) {
    // A lost answer is the same hazard as an unreachable runner below: any of
    // the actions may have taken effect, so this must not invite a repeat.
    const fields = runnerRequestFailure(result, resolved);
    return result.mayHaveArrived
      ? {
          ...fields,
          error: appendSentence(
            fields.error,
            interactiveRunnerMessages.actionsMayHaveHappened,
          ),
        }
      : fields;
  }

  const answer = result.value;
  const frames = await writeSequenceFrames(
    { answer, out: options.screenshot, screenshotMode },
    deps,
  );
  ctx.ui.output(
    withoutFrames(answer, frames.written),
    answer.outcome === "success"
      ? frames.written.length === 0
        ? interactiveRunnerMessages.actionsPerformed(answer.results.length)
        : interactiveRunnerMessages.actionsPerformedScreenshotWritten(
            answer.results.length,
            frames.written.at(-1) ?? options.screenshot ?? "",
          )
      : describeSequenceFailure({ actions: read.actions, answer }).error,
  );
  if (frames.problem !== undefined) return frames.problem;
  if (answer.outcome === "success") return undefined;
  return describeSequenceFailure({ actions: read.actions, answer });
}
