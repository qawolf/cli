import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { BrowserActionFlags } from "~/core/interactiveRunner/browserAction.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { describePerformActionFailure } from "./performActionFailure.js";
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
 */
export async function handleRunnerAct(
  ctx: AuthCommandContext,
  options: {
    flags: BrowserActionFlags;
    runner: string | undefined;
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

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.performAction,
    { action: built.action, id: resolved.runnerId },
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
