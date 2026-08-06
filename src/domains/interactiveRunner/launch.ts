import {
  type RunnerNameForPublicApi,
  publicContractsV1,
  runnerIdSchema,
  runnerNameSchema,
} from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";

type LaunchedRunner = {
  gpuAccelerated: boolean;
  id: string;
  outcome: "launched" | "already-running";
  runnerName: RunnerNameForPublicApi;
};

type LaunchResult =
  | { ok: true; value: LaunchedRunner }
  | { ok: false; error: string; exitCode: number };

/**
 * Launches a runner under `id`, or attaches to the one already running there.
 * The distinction is in `outcome`, and every caller passes it on: an agent about
 * to drive a browser needs to know whether it is looking at a fresh one.
 */
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
  );
  if (!result.ok) {
    return { error: result.error, exitCode: exitCodes.network, ok: false };
  }
  return { ok: true, value: result.value };
}

/**
 * Launches `id` and makes it this directory's default.
 *
 * The id is recorded before the request rather than after it. `runner.launch` is
 * a write, so it gets one attempt and a deadline; a pod that takes longer than
 * the deadline to come up is created and billed even though the answer never
 * arrived. An id recorded only on success would be lost in exactly that case,
 * and the next command would mint a fresh one and pay for a second pod. Recorded
 * first, a retry addresses the same id and the contract attaches to the runner
 * already running under it.
 *
 * Recording is best effort. The pod is the thing that costs money, so a working
 * directory the CLI cannot write to must not turn a launch that worked into a
 * failed command with an unnamed runner left behind.
 */
export async function launchAndRemember(
  ctx: AuthCommandContext,
  options: { id: string; runnerName: RunnerNameForPublicApi | undefined },
  deps: InteractiveRunnerDeps,
): Promise<LaunchResult> {
  await deps.store.writeDefaultRunnerId(options.id).catch(() => {
    ctx.ui.warn(interactiveRunnerMessages.defaultNotRemembered(options.id));
  });

  const launched = await launchRunner(ctx, options);
  if (launched.ok) return launched;
  return {
    error: interactiveRunnerMessages.launchFailed(options.id, launched.error),
    exitCode: launched.exitCode,
    ok: false,
  };
}

/**
 * Validates a runner id or image name against the published schema before it
 * reaches the wire, so a typo is answered with the rule it broke rather than
 * with a round trip.
 */
export function parseRunnerId(
  id: string,
): { ok: true; id: string } | { ok: false; error: string } {
  const parsed = runnerIdSchema.safeParse(id);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { id: parsed.data, ok: true };
}

function parseRunnerName(
  runnerName: string,
):
  | { ok: true; runnerName: RunnerNameForPublicApi }
  | { ok: false; error: string } {
  const parsed = runnerNameSchema.safeParse(runnerName);
  if (!parsed.success)
    return { error: z.prettifyError(parsed.error), ok: false };
  return { ok: true, runnerName: parsed.data };
}

export async function handleRunnerLaunch(
  ctx: AuthCommandContext,
  options: { id: string | undefined; name: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const chosenId = options.id ?? deps.makeRunnerId();
  const id = parseRunnerId(chosenId);
  if (!id.ok) return { error: id.error, exitCode: exitCodes.invalidArgs };

  const runnerName =
    options.name === undefined ? undefined : parseRunnerName(options.name);
  if (runnerName !== undefined && !runnerName.ok) {
    return { error: runnerName.error, exitCode: exitCodes.invalidArgs };
  }

  // Also this directory's default, so the commands that follow need no
  // --runner. Set even when the runner turns out to have been running already:
  // the caller has just named which runner this directory means.
  const launched = await launchAndRemember(
    ctx,
    { id: id.id, runnerName: runnerName?.runnerName },
    deps,
  );
  if (!launched.ok) {
    return { error: launched.error, exitCode: launched.exitCode };
  }

  ctx.ui.output(
    launched.value,
    launched.value.outcome === "launched"
      ? interactiveRunnerMessages.launched(launched.value.id)
      : interactiveRunnerMessages.alreadyRunning(launched.value.id),
  );
  return undefined;
}
