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
import { runnerCallOptions } from "./runnerCallOptions.js";

/**
 * Stops what a runner is executing and leaves the runner up, with its browser on
 * whatever page the run reached.
 *
 * The counterpart of `terminate`, which ends the runner itself. Nothing about the
 * directory's stored default changes here, because the runner this was sent to is
 * still the one later commands should reach.
 */
export async function handleRunnerStopRun(
  ctx: AuthCommandContext,
  options: { runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // Never launches. A fresh runner is running nothing, so the only thing a
  // launch here could buy the caller is a billed pod.
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.stopRun,
    { id: resolved.runnerId },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  if (result.value.outcome === "failure") {
    result.value.failureReason satisfies "runner-unreachable";
    // Retryable, unlike the other verbs that may have taken effect before their
    // answer was lost. Stopping a runner that is already idle does nothing.
    return {
      error: interactiveRunnerMessages.runnerUnreachable,
      exitCode: exitCodes.network,
    };
  }

  // A stop that found nothing to stop is still a stop. The caller asked for the
  // runner to be idle and it is, so reporting it as a failure would have a
  // harness retrying its way to the same answer.
  ctx.ui.output(
    result.value,
    result.value.wasRunning
      ? interactiveRunnerMessages.runStopped(resolved.runnerId)
      : interactiveRunnerMessages.nothingToStop(resolved.runnerId),
  );
  return undefined;
}
