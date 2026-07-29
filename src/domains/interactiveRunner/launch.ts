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

export type LaunchResult =
  | { ok: true; value: LaunchedRunner }
  | { ok: false; error: string; exitCode: number };

/**
 * Launches a runner under `id`, or attaches to the one already running there.
 * The distinction is in `outcome`, and every caller passes it on: an agent about
 * to drive a browser needs to know whether it is looking at a fresh one.
 */
export async function launchRunner(
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

  const launched = await launchRunner(ctx, {
    id: id.id,
    runnerName: runnerName?.runnerName,
  });
  if (!launched.ok) {
    return { error: launched.error, exitCode: launched.exitCode };
  }

  // The workspace's default, so the commands that follow need no --runner. Set
  // even when the runner was already running: the caller has just named which
  // runner this directory means.
  await deps.store.writeDefaultRunnerId(launched.value.id);

  ctx.ui.output(
    launched.value,
    launched.value.outcome === "launched"
      ? interactiveRunnerMessages.launched(launched.value.id)
      : interactiveRunnerMessages.alreadyRunning(launched.value.id),
  );
  return undefined;
}
