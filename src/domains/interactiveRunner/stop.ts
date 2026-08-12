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

export async function handleRunnerStop(
  ctx: AuthCommandContext,
  options: { runner: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // Never launches: starting a runner in order to stop it would bill one for
  // nothing, so a caller with no runner is told rather than served.
  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: false, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.stop,
    {
      id: resolved.runnerId,
    },
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  // Whether it was running or already gone, this runner is not somewhere later
  // commands in this directory should be sent. Best effort, for the same reason
  // the launch side is: the pod is what costs money, and a directory the CLI
  // cannot write to must not turn a stop that worked into a failed command.
  await deps.store
    .readDefaultRunnerId()
    .then(async (storedDefault) => {
      if (storedDefault === resolved.runnerId) {
        await deps.store.clearDefaultRunnerId();
      }
    })
    .catch(() => {
      ctx.ui.warn(
        interactiveRunnerMessages.defaultNotForgotten(resolved.runnerId),
      );
    });

  ctx.ui.output(
    result.value,
    result.value.outcome === "stopped"
      ? interactiveRunnerMessages.stopped(result.value.id)
      : interactiveRunnerMessages.notRunning(result.value.id),
  );
  return undefined;
}
