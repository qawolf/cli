import {
  type RunnerNameForPublicApi,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import {
  failureFields,
  type PlatformFailure,
} from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

type LaunchedRunner = z.output<typeof publicContractsV1.runner.launch.output>;

type LaunchFailure = PlatformFailure & { ok: false; exitCode: number };

type LaunchResult = { ok: true; value: LaunchedRunner } | LaunchFailure;

async function launchRunner(
  ctx: AuthCommandContext,
  options: { id: string; runnerName: RunnerNameForPublicApi | undefined },
): Promise<LaunchResult> {
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.launch,
    {
      id: options.id,
      ...(options.runnerName ? { runnerName: options.runnerName } : {}),
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    return {
      ...failureFields(result),
      exitCode: result.exitCode ?? exitCodes.network,
      mayHaveArrived: result.mayHaveArrived ?? false,
      ok: false,
    };
  }
  return { ok: true, value: result.value };
}

export async function launchAndRemember(
  ctx: AuthCommandContext,
  options: { id: string; runnerName: RunnerNameForPublicApi | undefined },
  deps: InteractiveRunnerDeps,
): Promise<LaunchResult> {
  const priorDefault = await deps.store
    .readDefaultRunnerId()
    .catch(() => undefined);
  const remembered = await deps.store
    .rememberLaunch({ id: options.id, runnerName: options.runnerName })
    .then(() => true)
    .catch(() => {
      ctx.ui.warn(interactiveRunnerMessages.defaultNotRemembered(options.id));
      return false;
    });

  const launched = await launchRunner(ctx, options);
  if (launched.ok) {
    if (remembered) {
      await deps.store
        .rememberLaunch({
          id: options.id,
          runnerName: launched.value.runnerName,
        })
        .catch(() => undefined);
    }
    return launched;
  }

  if (remembered && !launched.mayHaveArrived) {
    await deps.store.forgetRunner(options.id).catch(() => undefined);
    if (priorDefault !== undefined) {
      await deps.store
        .writeDefaultRunnerId(priorDefault)
        .catch(() => undefined);
    }
  }
  return {
    ...launched,
    error: launched.mayHaveArrived
      ? interactiveRunnerMessages.launchLost(options.id, launched.error)
      : interactiveRunnerMessages.launchFailed(options.id, launched.error),
  };
}
